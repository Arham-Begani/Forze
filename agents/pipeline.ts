import { z } from 'zod'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
    streamPrompt,
    extractJSON,
    withTimeout,
    withRetry,
    getFlashModel,
    Content,
} from '@/lib/gemini'
import {
    resolveLandingComponent,
    isRenderableLandingComponent,
    validateLandingComponent,
    summariseIssues,
    type LandingComponentIssue,
} from '@/lib/landing-page'
import { sanitize, sanitizeLabel } from '@/lib/sanitize'
import { getVenturePublic } from '@/lib/queries'
import { DesignTokensSchema } from '@/lib/schemas/inspiration'
import { tokensToPromptDigest, tokensToCssVarBlock, tokensToDesignBriefing } from '@/lib/inspiration/tokens'
import type { LandingAsset } from '@/lib/schemas/landing-assets'

// ── User-supplied landing assets ─────────────────────────────────────────────
//
// The founder may upload logos, hero photos, product screenshots, team
// portraits, etc. via /api/ventures/[id]/assets. The run route attaches the
// list to venture.context.landingAssets (an array of LandingAsset rows).
// We build a deterministic, agent-friendly block from those rows so the
// LLM places real URLs in the generated component instead of stock placeholders.
function buildLandingAssetsBlock(rawAssets: unknown): string | null {
    if (!Array.isArray(rawAssets) || rawAssets.length === 0) return null
    const assets = rawAssets
        .filter((a): a is LandingAsset => !!a && typeof a === 'object' && typeof (a as { publicUrl?: unknown }).publicUrl === 'string')
        .slice(0, 24)
    if (assets.length === 0) return null

    // Group by kind so the prompt reads top-down: logos first, then hero,
    // then product / feature / etc. The LLM can use this ordering as a hint
    // about which assets are "global brand" vs "section-specific."
    const KIND_ORDER: Array<LandingAsset['kind']> = [
        'logo', 'hero', 'background', 'product', 'feature', 'team', 'testimonial', 'customer-logo', 'image',
    ]
    const sorted = [...assets].sort((a, b) => {
        const aRank = KIND_ORDER.indexOf(a.kind)
        const bRank = KIND_ORDER.indexOf(b.kind)
        if (aRank !== bRank) return (aRank === -1 ? 99 : aRank) - (bRank === -1 ? 99 : bRank)
        return a.createdAt.localeCompare(b.createdAt)
    })

    const lines: string[] = []
    for (let i = 0; i < sorted.length; i++) {
        const asset = sorted[i]
        const dimensions = (asset.width && asset.height) ? ` (${asset.width}×${asset.height})` : ''
        const label = asset.label?.trim() || '(no label)'
        const alt = asset.altText?.trim() || asset.label?.trim() || asset.kind
        lines.push(`  ${i + 1}. [${asset.kind}] ${label}${dimensions}`)
        lines.push(`     URL: ${asset.publicUrl}`)
        lines.push(`     ALT: ${alt}`)
    }

    return [
        '## User-Supplied Images (REQUIRED — use these exact URLs)',
        '',
        'The founder uploaded these images. Embed them in the generated landing page using the exact public URLs listed below. Do NOT use stock-photo URLs (unsplash, pexels, placeholder.com, picsum), do NOT use absolute paths like `/images/...`, do NOT invent file names. Every <img> in the component must reference one of these URLs verbatim or be omitted.',
        '',
        'Placement guidance by kind:',
        '  • `logo` — nav bar logo + footer logo (use the same URL in both places).',
        '  • `hero` — hero section background or featured image. If a hero image is provided, lay the headline over it or float it next to the copy.',
        '  • `background` — section-level background (use as `background-image` style).',
        '  • `product` — product screenshot in the features or hero section.',
        '  • `feature` — illustrate a specific feature card.',
        '  • `team` — about / team section portrait.',
        '  • `testimonial` — customer face inside a testimonial card.',
        '  • `customer-logo` — logo strip ("Trusted by") above social proof.',
        '  • `image` — generic; place wherever it makes sense given the alt text.',
        '',
        'Implementation rules:',
        '  • Use <img src="EXACT_URL_FROM_BELOW" alt="EXACT_ALT_FROM_BELOW" loading="lazy" /> for foreground images.',
        '  • Use `style={{ backgroundImage: "url(EXACT_URL_FROM_BELOW)" }}` for background images.',
        '  • If a logo URL ends in `.svg`, render at the natural intrinsic size; for other types apply explicit className width/height (e.g. `h-8 w-auto`).',
        '  • Never reference an asset that is not in this list. If a section needs an image and no matching asset exists, use an inline <svg> illustration or a tasteful CSS gradient — never a stock URL.',
        '',
        'Available assets:',
        ...lines,
    ].join('\n')
}



// ── PipelineOutput Zod Schema ────────────────────────────────────────────────

const PipelineOutputSchema = z.object({
    sitemap: z.array(
        z.object({
            page: z.string().default('Untitled Page'),
            path: z.string().default('/'),
            purpose: z.string().default('Page purpose pending.'),
        })
    ).default([]),
    landingPageCopy: z.object({
        hero: z.object({
            headline: z.string().default('Idea to launch in minutes.'),
            subheadline: z.string().default('The fastest way to validate your next big thing.'),
            ctaPrimary: z.string().default('Get Started'),
            ctaSecondary: z.string().default('Learn More'),
        }).default({
            headline: 'Idea to launch in minutes.',
            subheadline: 'The fastest way to validate your next big thing.',
            ctaPrimary: 'Get Started',
            ctaSecondary: 'Learn More'
        }),
        features: z.array(
            z.object({
                title: z.string().default('Feature'),
                description: z.string().default('Feature description pending.'),
                icon: z.string().default('🚀'),
            })
        ).default([]),
        socialProof: z.array(z.string()).default([]),
        pricing: z.array(
            z.object({
                tier: z.string().default('Pro'),
                price: z.string().default('$0'),
                features: z.array(z.string()).default([]),
                cta: z.string().default('Start Now'),
            })
        ).default([]),
        faq: z.array(
            z.object({
                question: z.string().default('Question?'),
                answer: z.string().default('Answer pending.'),
            })
        ).default([]),
    }).default({
        hero: { headline: 'Idea to launch in minutes.', subheadline: '...', ctaPrimary: '...', ctaSecondary: '...' },
        features: [],
        socialProof: [],
        pricing: [],
        faq: []
    }),
    fullComponent: z.string().default('export default function LandingPage() { return <div>Landing Page Pending</div> }'),
    deploymentUrl: z.string().default(''),
    leadCaptureActive: z.boolean().default(false),
    analyticsActive: z.boolean().default(false),
    seoMetadata: z.object({
        title: z.string().default('Forze Startup'),
        description: z.string().default('Built with Forze AI.'),
        keywords: z.array(z.string()).default([]),
    }).default({
        title: 'Forze Startup',
        description: 'Built with Forze AI.',
        keywords: []
    }),
    // ── Decision Layer ──
    positioningAngles: z.array(z.string()).default([]),
    headlineWeaknesses: z.array(z.string()).default([]),
    ctaWeaknesses: z.array(z.string()).default([]),
    sectionToPainPointMap: z.record(z.string(), z.string()).default({}),
    recommendedPageDirection: z.string().default('Page direction pending.'),
    alignmentWarnings: z.array(z.string()).default([]),
})

export type PipelineOutput = z.infer<typeof PipelineOutputSchema>

// ── Edit Patch Schema (all fields optional — for surgical updates) ───────────

const PipelineEditPatchSchema = z.object({
    sitemap: z.array(
        z.object({
            page: z.string(),
            path: z.string(),
            purpose: z.string(),
        })
    ).optional(),
    landingPageCopy: z.object({
        hero: z.object({
            headline: z.string().optional(),
            subheadline: z.string().optional(),
            ctaPrimary: z.string().optional(),
            ctaSecondary: z.string().optional(),
        }).optional(),
        features: z.array(
            z.object({
                title: z.string(),
                description: z.string(),
                icon: z.string(),
            })
        ).optional(),
        socialProof: z.array(z.string()).optional(),
        pricing: z.array(
            z.object({
                tier: z.string(),
                price: z.string(),
                features: z.array(z.string()),
                cta: z.string(),
            })
        ).optional(),
        faq: z.array(
            z.object({
                question: z.string(),
                answer: z.string(),
            })
        ).optional(),
    }).optional(),
    fullComponent: z.string().optional(),
    seoMetadata: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        keywords: z.array(z.string()).optional(),
    }).optional(),
    // ── Decision Layer ──
    positioningAngles: z.array(z.string()).optional(),
    headlineWeaknesses: z.array(z.string()).optional(),
    ctaWeaknesses: z.array(z.string()).optional(),
    sectionToPainPointMap: z.record(z.string(), z.string()).optional(),
    recommendedPageDirection: z.string().optional(),
    alignmentWarnings: z.array(z.string()).optional(),
})

type PipelineEditPatch = z.infer<typeof PipelineEditPatchSchema>

// ── Merge patch into existing result ─────────────────────────────────────────

function mergePatch(existing: PipelineOutput, patch: PipelineEditPatch): PipelineOutput {
    const merged = { ...existing }

    if (patch.sitemap) merged.sitemap = patch.sitemap
    if (patch.fullComponent !== undefined) merged.fullComponent = patch.fullComponent

    if (patch.landingPageCopy) {
        merged.landingPageCopy = { ...existing.landingPageCopy }
        if (patch.landingPageCopy.hero) {
            merged.landingPageCopy.hero = {
                ...existing.landingPageCopy.hero,
                ...patch.landingPageCopy.hero,
            }
        }
        if (patch.landingPageCopy.features) merged.landingPageCopy.features = patch.landingPageCopy.features
        if (patch.landingPageCopy.socialProof) merged.landingPageCopy.socialProof = patch.landingPageCopy.socialProof
        if (patch.landingPageCopy.pricing) merged.landingPageCopy.pricing = patch.landingPageCopy.pricing
        if (patch.landingPageCopy.faq) merged.landingPageCopy.faq = patch.landingPageCopy.faq
    }

    if (patch.seoMetadata) {
        merged.seoMetadata = {
            ...existing.seoMetadata,
            ...patch.seoMetadata,
        }
    }

    // Decision layer
    if (patch.positioningAngles) merged.positioningAngles = patch.positioningAngles
    if (patch.headlineWeaknesses) merged.headlineWeaknesses = patch.headlineWeaknesses
    if (patch.ctaWeaknesses) merged.ctaWeaknesses = patch.ctaWeaknesses
    if (patch.sectionToPainPointMap) merged.sectionToPainPointMap = patch.sectionToPainPointMap
    if (patch.recommendedPageDirection !== undefined) merged.recommendedPageDirection = patch.recommendedPageDirection
    if (patch.alignmentWarnings) merged.alignmentWarnings = patch.alignmentWarnings

    return merged
}

// ── Deployment Stub ──────────────────────────────────────────────────────────

async function deployLandingPage(ventureId: string, result: PipelineOutput): Promise<string> {
    // Prefer the venture's wildcard subdomain (e.g. https://feedflow.forze.in)
    // and fall back to the legacy /v/[id] path if no subdomain is set or the
    // app URL is unavailable.
    const venture = await getVenturePublic(ventureId).catch(() => null)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    if (venture?.subdomain && appUrl) {
        try {
            const url = new URL(appUrl)
            const host = url.host.startsWith('www.') ? url.host.slice(4) : url.host
            return `${url.protocol}//${venture.subdomain}.${host}`
        } catch {
            // fall through to legacy
        }
    }
    return `/v/${ventureId}`
}

// ── Validator integration ────────────────────────────────────────────────────
//
// Runs the static landing-component validator and streams findings to the
// founder so they can see exactly what was caught (and what we auto-fixed
// vs. what they need to revisit). Returns the sanitized component string —
// imports of unavailable libraries get commented out, `process.env.X`
// references get replaced with `""`, everything else is reported only.
//
// The "errorCount" return is used by the caller to decide whether to
// surface a louder warning (e.g. an "Errors detected" tag in the stream
// preamble). All severities are reported individually below.
async function runComponentValidator(
    component: string,
    onStream: (line: string) => Promise<void>,
    contextLabel: 'Initial generation' | 'Edit mode',
): Promise<{ sanitized: string; issues: LandingComponentIssue[]; hasErrors: boolean }> {
    const { issues, sanitized, hasErrors } = validateLandingComponent(component)
    if (issues.length === 0) {
        await onStream(`\n[${contextLabel}] Component validator: clean — no issues detected.\n`)
        return { sanitized, issues, hasErrors }
    }
    const headline = hasErrors
        ? `[${contextLabel}] Component validator: ${summariseIssues(issues)} — auto-fixed where safe.`
        : `[${contextLabel}] Component validator: ${summariseIssues(issues)} — auto-fixed where safe.`
    await onStream(`\n${headline}\n`)
    const MAX_REPORTED = 12
    for (const issue of issues.slice(0, MAX_REPORTED)) {
        const tag = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '!' : '·'
        const fix = issue.autoFixed ? ' [auto-fixed]' : ''
        const loc = typeof issue.line === 'number' ? ` (line ${issue.line})` : ''
        await onStream(`  ${tag} ${issue.message}${loc}${fix}\n`)
    }
    if (issues.length > MAX_REPORTED) {
        await onStream(`  … ${issues.length - MAX_REPORTED} more issue${issues.length - MAX_REPORTED === 1 ? '' : 's'} not shown.\n`)
    }
    return { sanitized, issues, hasErrors }
}

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
# Production Pipeline — Deployment Specialist

You are Forze's elite build-and-ship agent. You transform venture context into a stunning, fully-functional landing page that is ready to capture leads from day one.

## Context Required

Before writing any code or copy:
1. Read venture.context.research — positioning, pain points, competitor gaps, TAM, target audience
2. Read venture.context.branding — brand name, voice, tone, colors, typography, tagline, archetype
3. Read venture.context.marketing (if available) — messaging angles, GTM strategy, content pillars
4. Synthesize ALL available context into a coherent, high-conversion landing page

## What You Build

### 1. Sitemap (5 pages minimum)
For each page provide: page name, path, and a detailed purpose description (2-3 sentences explaining what the page does and why it exists).

Pages:
- Home (/) — Primary conversion page with hero, features, social proof, pricing, FAQ, and lead capture
- Features (/features) — Deep dive into product capabilities with use cases
- Pricing (/pricing) — Transparent pricing with comparison table and FAQ
- About (/about) — Team story, mission, values, and trust signals
- FAQ (/faq) — Comprehensive objection handling and support

### 2. Landing Page Copy (DETAILED — this is the core deliverable)

**Hero Section** — The most critical 5 seconds of the page
- Headline: benefit-led, specific, emotionally compelling, under 12 words. Must reference the #1 pain point from research.
- Subheadline: expands the headline, quantifies the benefit, addresses the "how", under 30 words
- Primary CTA: action verb + clear benefit + urgency (e.g. "Start Building Free — No Credit Card Required")
- Secondary CTA: lower commitment (e.g. "Watch 2-Min Demo", "See How It Works")

**Features Section (6 features minimum)**
Each feature must include:
- Title: concise, benefit-oriented name
- Description: 2-3 sentences in brand voice explaining what it does AND why it matters to the target user. Include specific benefits, not vague claims.
- Icon: an emoji ONLY (e.g. "⚡", "🚀", "🛡️", "💎") — do NOT return a Lucide/Heroicons name like "Shield" or "User"; the rendered component must use the emoji as-is or wrap it in an SVG, never reference an icon library

**Social Proof Section (3 detailed testimonials)**
Each testimonial must be:
- 2-3 sentences long, specific about the result achieved
- Include a fictional but realistic person name, job title, and company name that matches the target market
- Reference specific metrics or outcomes (e.g. "reduced onboarding time by 60%")
Format as: "Quote text" — Name, Title at Company

**Pricing Section (3 tiers with full detail)**
Each tier must include:
- Tier name that matches brand personality
- Price (monthly) appropriate to the market research findings
- 5-7 specific features per tier (not vague — "10GB storage" not "Storage")
- CTA text specific to that tier
- Mark the recommended tier

**FAQ Section (6-8 questions)**
- Address the top objections and concerns identified in research
- Each answer should be 2-4 sentences, written in brand voice
- Include questions about: pricing, getting started, data/security, integrations, support, and competitive advantage

### 3. Full React Component (THE LIVE SITE)

Generate a COMPLETE, production-quality landing page as a single React functional component. This is rendered live — it must be beautiful and fully working.

**Technical Requirements:**
- Single functional component exported as default
- Use Tailwind CSS for ALL styling (the page loads Tailwind CDN)
- Use React hooks (useState, useEffect, useRef, useMemo, useCallback) for interactivity — these are pre-destructured from React and available globally
- Do NOT use import statements (they will be stripped for preview rendering)
- Mobile-responsive design with proper breakpoints (sm:, md:, lg:)
- Smooth scroll navigation between sections
- Accessible (proper heading hierarchy, aria-labels on interactive elements, contrast ratios)

**Runtime Constraints (CRITICAL — non-negotiable. The page renders inside a sandboxed iframe with React UMD + Tailwind CDN + Babel-standalone. Nothing else is loaded.)**

ALLOWED globals only:
- \`React\`, \`ReactDOM\`
- Pre-destructured hooks: \`useState\`, \`useEffect\`, \`useRef\`, \`useCallback\`, \`useMemo\`, \`useReducer\`, \`useLayoutEffect\`, \`useId\`, \`Fragment\`, \`Children\`, \`cloneElement\`, \`createContext\`, \`useContext\`, \`forwardRef\`, \`memo\`
- Tailwind utility classes (any class from cdn.tailwindcss.com)
- \`window.__VENTURE_ID__\` — for the lead-capture + analytics POST endpoints
- Native browser APIs: \`fetch\`, \`IntersectionObserver\`, \`setTimeout\`, \`localStorage\`, etc.

FORBIDDEN — these are NOT available and WILL crash the page if referenced:
- \`lucide-react\`, \`LucideIcons\`, \`Lucide\`, \`LucideReact\` — no Lucide icons
- \`Heroicons\`, \`HeroIcons\`, \`HiIcons\` — no Heroicons
- \`FontAwesome\`, \`FaIcons\`, \`FontAwesomeIcon\` — no Font Awesome
- \`react-icons\`, \`FiIcons\`, \`BiIcons\`, \`TbIcons\`, \`PhIcons\`, \`MdIcons\`, \`IoIcons\`, \`SiIcons\`, \`GiIcons\` — no react-icons
- \`Feather\`, \`Tabler\`, \`Phosphor\`, \`MaterialIcons\` — no other icon libraries
- Bare component icon names like \`<Shield />\`, \`<User />\`, \`<Check />\`, \`<ArrowRight />\`, \`<ChevronDown />\`, \`<Star />\`, \`<Mail />\`, \`<Zap />\`, \`<Sparkles />\`, \`<Lock />\` — these resolve to undefined
- \`framer-motion\` — \`motion.div\`, \`<AnimatePresence>\`, \`<LazyMotion>\` are not available
- Next.js components — no \`<Image>\`, no \`<Link>\`, no \`useRouter\`
- Utility libraries — no \`clsx\`, \`cn\`, \`classNames\`, \`twMerge\`, \`tailwind-merge\`
- \`import\` statements of any kind — they get stripped at render time

**For icons you MUST use ONE of these three approaches (no exceptions):**
1. An emoji rendered as a plain string in JSX: \`<div className="text-2xl">⚡</div>\`, \`🚀\`, \`🛡️\`, \`✓\`, \`→\`, \`★\`, \`💎\`, \`✨\`, \`🔒\`
2. An inline \`<svg>\` element with explicit \`viewBox\`, \`fill\`, \`stroke\`, and \`<path>\` / \`<circle>\` / \`<rect>\` children. Example: \`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2C20 17.5 12 22 12 22z"/></svg>\`
3. A Tailwind-styled div with a Unicode glyph: \`<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white text-lg">▲</div>\`

If you write \`<LucideIcons.Shield />\`, \`<Shield />\`, or \`import { Shield } from 'lucide-react'\`, the generated page will throw \`ReferenceError\` or \`Cannot read properties of undefined\` at render time. The founder will see a broken page. Use inline SVG.

**Design Requirements (aim for Stripe / Linear / Vercel quality):**
- Use the EXACT brand colors from the Identity output as CSS custom properties in a style tag (--color-primary, --color-secondary, --color-accent)
- Dark hero section with gradient using brand colors — avoid plain white heroes; use deep backgrounds with vibrant gradient overlays
- Glassmorphism feature cards: bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl — creates premium feel
- Sticky navigation bar: semi-transparent background (bg-white/80 dark backdrop-blur-xl), logo, nav links, and a CTA button
- Hero: full-viewport-height gradient section, large bold headline (text-5xl md:text-7xl), animated gradient text on the key benefit phrase, floating accent shapes as decorative elements using absolute positioning
- Feature cards: icon in a colored rounded square, title in semibold, description in muted text, hover:scale-105 hover:shadow-xl transition-all duration-300
- Testimonial cards: quote marks as decorative elements, avatar initials in branded colored circles, star ratings
- Pricing: dark recommended tier card with ring-2 ring-[brand-accent] scale-105 relative, "Most Popular" badge using absolute top-0 translate-y-[-50%]
- FAQ accordion: smooth max-height transition (not display:none/block), chevron rotation on open
- Section transitions: alternating light/dark backgrounds for visual rhythm
- Typography: tight tracking on headings (tracking-tight), generous line-height on body, all-caps small label above major headings (text-xs uppercase tracking-widest opacity-60)
- Professional spacing: py-24 between sections, max-w-7xl container, px-4 sm:px-6 lg:px-8
- Subtle animations: fade-in + slide-up on scroll using IntersectionObserver, staggered delays on feature cards using inline style animationDelay of 0.1s per index
- Shadow hierarchy: shadow-sm on inputs, shadow-lg on cards, shadow-2xl on modals/CTAs

**Lead Capture Form:**
- Email input with field validation (basic regex)
- Submit button with loading state
- Success state with checkmark animation and confirmation message
- Form MUST submit a POST request to \`/api/ventures/\${ventureId}/leads\` with JSON body \`{ email: string, source: 'landing_page' }\`. Resolve ventureId in this exact order — DO NOT hardcode the venture name: \`const ventureId = (typeof window !== 'undefined' && window.__VENTURE_ID__) || (typeof window !== 'undefined' ? (window.location.pathname.split('/v/')[1] || '').split(/[/?#]/)[0] : '') || '';\`. If ventureId is empty, abort the submission and show an error — never POST to an empty or non-UUID id.
- NEVER post to a third-party form endpoint: not \`api.v0.dev/leads/...\`, not \`formspree.io\`, not \`getform.io\`, not Mailchimp/ConvertKit/Beehiiv embed URLs, not any cross-origin host. The page runs under a strict CSP that allows only same-origin connect-src — any external POST is blocked at the browser and the founder sees a broken waitlist. The ONLY allowed lead endpoint is \`/api/ventures/\${ventureId}/leads\` on the same origin.
- Handle loading and errors gracefully.

**Analytics Tracking:**
- Include a \`useEffect\` that sends a POST request to \`/api/ventures/\${ventureId}/track\` with JSON body \`{ event_type: 'pageview', metadata: { source: 'landing_page' } }\` when the component mounts. Resolve ventureId the same way as the lead form (prefer \`window.__VENTURE_ID__\`); skip the request if ventureId is empty.

**Forze Watermark (Required — always include this):**
Include a fixed-position "Built with Forze" badge in the bottom-right corner. Place it as the LAST element inside the returned JSX, before the final closing tag. Use these exact inline styles: position fixed, bottom 20px, right 20px, zIndex 9999, display flex, alignItems center, gap 6px, background rgba(0,0,0,0.85), color white, fontSize 11px, fontWeight 500, padding 7px 14px, borderRadius 20px, textDecoration none, backdropFilter blur(10px), boxShadow 0 2px 12px rgba(0,0,0,0.3). The link should open https://tryForze.ai in a new tab. The label should be "⚡ Built with Forze".

**The fullComponent string must be the COMPLETE component code, starting with "function LandingPage()" or "const LandingPage = () =>" and ending with the closing brace. Include ALL sections: nav, hero, features, social proof, pricing, FAQ, CTA, footer, and watermark badge.**

### 4. Tech Stack & Infrastructure Detail
The landing page is built with:
- Framework: Next.js 15 (App Router)
- Styling: Tailwind CSS
- Language: TypeScript / React
- Hosting: Vercel (Edge)
- Analytics: Ready for Google Analytics / Mixpanel integration
- Forms: Client-side validation + API-ready POST handler
- SEO: Full meta tags, Open Graph ready

### 5. Decision Layer (REQUIRED)
Before writing copy, analyze the venture's positioning critically:
- **positioningAngles**: 2-3 distinct positioning angles this page could take (e.g. "cost-savings leader", "simplicity play", "premium expert tool"). Name each with a one-sentence explanation.
- **headlineWeaknesses**: 1-2 weaknesses of the headline you chose — what objection does it fail to address? What audience might it alienate?
- **ctaWeaknesses**: 1-2 weaknesses of the CTAs — are they too aggressive? Too passive? Missing urgency or specificity?
- **sectionToPainPointMap**: Map each page section to the specific pain point from research it addresses. If a section doesn't map to a real pain point, flag it.
- **recommendedPageDirection**: One-paragraph synthesis of why this page layout and messaging approach is the right direction.
- **alignmentWarnings**: If the hero headline, value proposition, or pricing contradicts research or branding data, list each discrepancy. Empty array if aligned.

### 6. Cross-Module Alignment Check
Verify against research and branding:
- Hero headline must reference the #1 pain point from Genesis research
- Copy tone must match Identity's brand voice
- Pricing tiers must align with market research positioning
- If contradictions exist, populate alignmentWarnings

### 7. SEO Metadata
- Title: brand name + primary value prop (under 60 chars)
- Description: compelling meta description with keywords (under 160 chars)
- Keywords: 8-12 relevant keywords based on research findings

## Output Rules

- Output strict JSON matching PipelineOutputSchema
- ALL copy must use brand voice from Identity output — NO generic marketing language
- Hero headline MUST reference the primary pain point from research
- Features MUST align with the competitive advantages identified in research
- Pricing MUST be appropriate for the target market identified in research
- The fullComponent MUST be a complete, self-contained, working React component
- Social proof names/companies must feel authentic to the target industry

## Output Schema

{
  "sitemap": [
    { "page": "string", "path": "string", "purpose": "string (2-3 detailed sentences)" }
  ],
  "landingPageCopy": {
    "hero": {
      "headline": "string",
      "subheadline": "string",
      "ctaPrimary": "string",
      "ctaSecondary": "string"
    },
    "features": [
      { "title": "string", "description": "string (2-3 sentences)", "icon": "string" }
    ],
    "socialProof": ["string (full testimonial with attribution)"],
    "pricing": [
      { "tier": "string", "price": "string", "features": ["string"], "cta": "string" }
    ],
    "faq": [
      { "question": "string", "answer": "string (2-4 sentences)" }
    ]
  },
  "fullComponent": "string (COMPLETE React component code — 200+ lines minimum, all sections included)",
  "deploymentUrl": "",
  "leadCaptureActive": true,
  "analyticsActive": false,
  "seoMetadata": {
    "title": "string (under 60 chars)",
    "description": "string (under 160 chars)",
    "keywords": ["string (8-12 keywords)"]
  },
  "positioningAngles": ["string (2-3 angles)"],
  "headlineWeaknesses": ["string (1-2 weaknesses)"],
  "ctaWeaknesses": ["string (1-2 weaknesses)"],
  "sectionToPainPointMap": {"section": "pain point it addresses"},
  "recommendedPageDirection": "string",
  "alignmentWarnings": ["string (empty array if aligned)"]
}

CRITICAL OUTPUT INSTRUCTION:
After your planning, output the complete package as a single valid JSON object.
The JSON must be the LAST thing you output. No text after the closing brace.
Output ONLY the JSON — no markdown fences, no explanation after.

IMPORTANT: Any step-by-step reasoning MUST be wrapped inside <think> and </think> tags. Only the final valid JSON should be outside the tags.
`

// ── Edit Mode System Prompt ──────────────────────────────────────────────────

const EDIT_SYSTEM_PROMPT = `
# Landing Page Edit Mode — Surgical Update Specialist

You are editing an EXISTING, production-quality landing page. The founder wants a specific change. Your job is to apply ONLY that change — nothing else.

## Rules

1. Output ONLY the fields that need to change as a JSON patch object.
2. Valid top-level keys: sitemap, landingPageCopy, fullComponent, seoMetadata. Do NOT include deploymentUrl, leadCaptureActive, or analyticsActive.
3. For landingPageCopy: include only the sub-objects that changed.
   - If only the hero headline changes: {"landingPageCopy": {"hero": {"headline": "new value"}}}
   - If only pricing tiers change: {"landingPageCopy": {"pricing": [... full replacement array ...]}}
   - Array fields (features, socialProof, pricing, faq) are always replaced entirely when included.
4. For fullComponent: if the React component code needs to change, output the COMPLETE updated component string — never a partial diff or patch. The component must remain a fully working React functional component with Tailwind CSS.
5. **CRITICAL — Copy-only changes**: If the user's change ONLY affects text content (name, headline, subheadline, CTA text, pricing text, FAQ text, testimonials, feature descriptions, SEO metadata), do NOT output fullComponent at all. Output ONLY the landingPageCopy and/or seoMetadata fields. The system will automatically find-and-replace the old text in the component. This is MUCH faster and preserves the exact design.
6. ONLY output fullComponent when the user explicitly asks for structural/visual changes (add/remove a section, change layout, modify colors, change animations, restyle elements, add new interactive features). Text/copy changes NEVER require fullComponent.
7. For seoMetadata: include only the fields that changed (title, description, or keywords).
8. For sitemap: include only if the site structure actually changes.
9. Preserve the EXACT brand colors, voice, and design quality of the original page.

## Runtime Constraints (CRITICAL — non-negotiable when emitting fullComponent)

The landing page renders inside a sandboxed iframe with ONLY React UMD + Tailwind CDN + Babel-standalone loaded. Nothing else is available.

ALLOWED globals only:
- \`React\`, \`ReactDOM\`
- Pre-destructured hooks: \`useState\`, \`useEffect\`, \`useRef\`, \`useCallback\`, \`useMemo\`, \`useReducer\`, \`useLayoutEffect\`, \`useId\`, \`Fragment\`, \`Children\`, \`cloneElement\`, \`createContext\`, \`useContext\`, \`forwardRef\`, \`memo\`
- Tailwind utility classes via cdn.tailwindcss.com
- \`window.__VENTURE_ID__\` for lead-capture + analytics POST endpoints

FORBIDDEN — these are NOT available and WILL crash the page if referenced:
- \`lucide-react\`, \`LucideIcons\`, \`Lucide\`, \`LucideReact\`
- \`Heroicons\`, \`HeroIcons\`, \`FontAwesome\`, \`FaIcons\`, \`FontAwesomeIcon\`, \`react-icons\`, \`Feather\`, \`Tabler\`, \`Phosphor\`, \`MaterialIcons\`
- Bare icon component names like \`<Shield />\`, \`<User />\`, \`<Check />\`, \`<X />\`, \`<ArrowRight />\`, \`<ChevronDown />\`, \`<Star />\`, \`<Mail />\`, \`<Zap />\`, \`<Sparkles />\`, \`<Lock />\` — these resolve to undefined and crash
- \`framer-motion\` (\`motion.div\`, \`<AnimatePresence>\`)
- Next.js components (\`<Image>\`, \`<Link>\`, \`useRouter\`)
- Utility libraries (\`clsx\`, \`cn\`, \`classNames\`, \`twMerge\`)
- \`import\` statements of any kind — they get stripped before render

**For icons you MUST use ONE of (no exceptions):**
1. An emoji rendered as a plain string: \`<div className="text-2xl">⚡</div>\`, \`🚀\`, \`🛡️\`, \`✓\`, \`→\`, \`★\`
2. An inline \`<svg>\` with \`viewBox\`, \`fill\`, \`stroke\`, and \`<path>\` / \`<circle>\` / \`<rect>\` children
3. A Tailwind-styled div with a Unicode glyph (e.g. \`<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white">▲</div>\`)

If the existing component already contains forbidden references (\`<LucideIcons.X />\`, \`<Shield />\`, framer-motion, etc.), you MUST emit a fullComponent that REPLACES those references with safe alternatives (inline SVG or emoji) as part of the requested change. Do not preserve broken code just because it was there before.

**Lead-capture endpoint (CRITICAL):** The form MUST POST to \`/api/ventures/\${ventureId}/leads\` on the same origin. NEVER post to \`api.v0.dev/leads\`, \`formspree.io\`, \`getform.io\`, or any third-party host — strict CSP blocks them and the founder sees a broken waitlist. If the existing component references a third-party lead endpoint, REPLACE it with \`/api/ventures/\${ventureId}/leads\` in the fullComponent you emit.

## Output Format

Output a single valid JSON object containing ONLY the changed fields. Example for a headline-only change:

{"landingPageCopy": {"hero": {"headline": "Your New Headline Here"}}}

Example for a component + copy change:

{"landingPageCopy": {"hero": {"headline": "New Headline"}}, "fullComponent": "function LandingPage() { ... complete code ... }"}

CRITICAL: Output ONLY the JSON patch — no markdown fences, no explanation after.
IMPORTANT: Any step-by-step reasoning MUST be wrapped inside <think> and </think> tags. Only the final valid JSON should be outside the tags.
`

// ── Agent Runner ──────────────────────────────────────────────────────────────

export async function runPipelineAgent(
    venture: { ventureId: string; name: string; globalIdea?: string; context: Record<string, unknown> },
    onStream: (line: string) => Promise<void>,
    onComplete: (result: PipelineOutput) => Promise<void>,
    history: Content[] = []
): Promise<void> {
    const hasResearch = !!venture.context.research
    const hasBranding = !!venture.context.branding

    const contextParts: string[] = []
    if (venture.context?.architectPlan) contextParts.push(`## Architect's Plan\n${sanitize(venture.context.architectPlan, 3000)}`)
    if (venture.globalIdea) contextParts.push(`## Global Startup Vision\n${sanitize(venture.globalIdea, 1000)}`)

    // Research — extract structured design tokens instead of raw JSON dump
    if (hasResearch) {
        const r = venture.context.research as Record<string, any>
        const lines: string[] = []
        if (r.marketSummary) lines.push(`Market: ${r.marketSummary}`)
        const tam = r.tam?.value || (typeof r.tam === 'string' ? r.tam : '')
        if (tam) lines.push(`TAM: ${tam}`)
        if (r.targetAudience || r.targetCustomer) lines.push(`Target customer: ${r.targetAudience || r.targetCustomer}`)
        if (r.competitorGap) lines.push(`Market gap: ${r.competitorGap}`)
        if (Array.isArray(r.painPoints) && r.painPoints.length > 0) {
            const pains = r.painPoints.slice(0, 5).map((p: any, i: number) => {
                const desc = typeof p === 'object' ? (p.description || p.name || JSON.stringify(p)) : String(p)
                return `  ${i + 1}. ${desc}`
            })
            lines.push(`Pain points (hero headline must address #1):\n${pains.join('\n')}`)
        }
        if (Array.isArray(r.competitors) && r.competitors.length > 0) {
            const comps = r.competitors.slice(0, 5).map((c: any) => {
                const name = typeof c === 'object' ? (c.name || JSON.stringify(c)) : String(c)
                const weakness = typeof c === 'object' ? (c.weakness || c.gap || '') : ''
                return `  - ${name}${weakness ? `: weakness = "${weakness}"` : ''}`
            })
            lines.push(`Competitors (name them in features & FAQ):\n${comps.join('\n')}`)
        }
        if (Array.isArray(r.topConcepts) && r.topConcepts.length > 0) {
            const concepts = r.topConcepts.slice(0, 3).map((c: any) =>
                `  - ${typeof c === 'object' ? (c.name || '') : String(c)}: ${typeof c === 'object' ? (c.rationale || '') : ''}`
            )
            lines.push(`Top product concepts:\n${concepts.join('\n')}`)
        }
        contextParts.push(`## Research Findings (use for positioning, pain points, pricing, and FAQ)\n${lines.join('\n')}`)
    }

    // Branding — extract design tokens explicitly
    if (hasBranding) {
        const b = venture.context.branding as Record<string, any>
        const lines: string[] = []
        if (b.brandName) lines.push(`Brand name: ${b.brandName}`)
        if (b.tagline) lines.push(`Tagline: "${b.tagline}"`)
        if (b.brandArchetype) lines.push(`Archetype: ${b.brandArchetype}`)
        if (b.toneOfVoice || b.brandVoice) lines.push(`Tone of voice: ${b.toneOfVoice || b.brandVoice}`)
        if (b.missionStatement) lines.push(`Mission: ${b.missionStatement}`)
        if (Array.isArray(b.colorPalette) && b.colorPalette.length > 0) {
            const colors = b.colorPalette.slice(0, 6).map((c: any) => {
                if (typeof c === 'string') return c
                const hex = c.hex || c.code || ''
                const name = c.name || c.role || ''
                return hex ? `${name ? name + ': ' : ''}${hex}` : (name || JSON.stringify(c))
            }).filter(Boolean)
            lines.push(`COLOR PALETTE (use these EXACT hex values for backgrounds, text, and accents):\n  ${colors.join('\n  ')}`)
        }
        if (b.typography || b.fonts) {
            const typo = typeof (b.typography || b.fonts) === 'object'
                ? JSON.stringify(b.typography || b.fonts)
                : String(b.typography || b.fonts)
            lines.push(`Typography: ${typo}`)
        }
        if (Array.isArray(b.brandPersonality) && b.brandPersonality.length > 0) {
            lines.push(`Brand personality: ${b.brandPersonality.join(', ')}`)
        }
        contextParts.push(`## Brand Identity (apply EXACT colors, voice, and tone to all copy and design)\n${lines.join('\n')}`)
    }

    // Marketing — extract key messaging angles
    if (venture.context.marketing) {
        const m = venture.context.marketing as Record<string, any>
        const lines: string[] = []
        const gtm = m.gtmStrategy || m
        if (gtm.overview) lines.push(`GTM: ${gtm.overview}`)
        const channels = gtm.channels || m.channels
        if (Array.isArray(channels) && channels.length > 0) {
            lines.push(`Channels: ${channels.slice(0, 5).map((c: any) => typeof c === 'object' ? (c.name || JSON.stringify(c)) : String(c)).join(', ')}`)
        }
        if (Array.isArray(m.emailSequence) && m.emailSequence.length > 0) {
            const subjects = m.emailSequence.slice(0, 3).map((e: any) => typeof e === 'object' ? (e.subject || e.title) : String(e))
            lines.push(`Email subjects: ${subjects.join(' | ')}`)
        }
        if (lines.length > 0) contextParts.push(`## Marketing Strategy (use these messaging angles)\n${lines.join('\n')}`)
    }

    // Inspiration tokens — when the founder has analyzed reference URLs and
    // pushed the resulting DesignTokens onto the venture (see
    // /api/ventures/[id]/inspiration/[analysisId]/apply), the pipeline agent
    // treats those as the PRIMARY design directive that overrides the
    // branding agent's palette and visual style on the landing page.
    //
    // The block we inject has three layers:
    //   1. A long-form design briefing (mood → concrete patterns) so the LLM
    //      knows HOW the inspiration should feel, not just its colors.
    //   2. A digest of the actual tokens (hex values, font names, sizes).
    //   3. A CSS custom-property declaration block so future token edits
    //      cascade through var(--insp-*) references instead of regenerating
    //      the whole component.
    let inspirationBlock: string | null = null
    // Reference screenshot images of the inspiration page(s), attached as
    // multimodal input to the Gemini call. The model sees the actual visual
    // target alongside the text briefing — major accuracy jump.
    const inspirationImages: Array<{ mimeType: string; data: string }> = []
    if (venture.context.inspirationTokens) {
        try {
            const tokens = DesignTokensSchema.parse(venture.context.inspirationTokens)
            const briefing = tokensToDesignBriefing(tokens)
            const digest = tokensToPromptDigest(tokens)
            const cssBlock = tokensToCssVarBlock(tokens)
            // Pull persisted reference images. Capped at 2 in the apply route
            // already; we double-check here in case the schema drifts.
            const refImagesRaw = (venture.context as { inspirationReferenceImages?: unknown }).inspirationReferenceImages
            if (Array.isArray(refImagesRaw)) {
                for (const img of refImagesRaw.slice(0, 2)) {
                    if (
                        img && typeof img === 'object' &&
                        typeof (img as { base64?: unknown }).base64 === 'string' &&
                        typeof (img as { mimeType?: unknown }).mimeType === 'string'
                    ) {
                        inspirationImages.push({
                            mimeType: (img as { mimeType: string }).mimeType,
                            data: (img as { base64: string }).base64,
                        })
                    }
                }
            }
            const hasImages = inspirationImages.length > 0
            inspirationBlock =
                `## Inspiration Design Directive (HIGHEST PRIORITY — overrides branding palette)\n\n` +
                (hasImages
                    ? `**A screenshot of the inspiration page is attached to this message.** Look at it. Your generated landing page must visually echo what you see — the same gradient strategy, hero layout, density, type weight, button shape, and surface treatment. The text briefing below describes what's in the image; the image itself is the truth.\n\n`
                    : '') +
                `The founder pasted one or more inspiration URLs (e.g. Stripe, Vercel, Linear) and locked in these design choices. ` +
                `For THIS landing page, the inspiration tokens AND aesthetic briefing below take precedence over the branding agent's color palette and any default styling instincts. ` +
                `Match the inspiration's FEEL, not just its colors — that means surfaces, density, motion, gradients, and corner treatment all need to match the briefing.\n\n` +
                briefing +
                `\n\n### Exact token values\n${digest}\n\n` +
                `### CSS custom properties — paste THIS BLOCK at the top of your inline <style> tag, then use var(--insp-*) throughout the component:\n` +
                `\`\`\`css\n${cssBlock}\n\`\`\`\n\n` +
                `### Implementation rules\n` +
                `- ALL background, text, border, and accent colors must reference the CSS vars above. No hardcoded hex outside the <style> block.\n` +
                `- The "Aesthetic North Star" line above is the single sentence that should describe how this page feels — write code that earns it.\n` +
                `- If the anti-patterns list above conflicts with your default landing-page instincts, the anti-patterns win.\n` +
                `- Brand mood is "${tokens.brand.mood}" — every section's visual treatment must read as that mood. A "luxury-premium" mood should NOT have bouncy hover states. A "tech-dark" mood should NOT have light cream backgrounds. Be consistent.` +
                (hasImages
                    ? `\n- **The attached screenshot is the visual target.** When the briefing and the screenshot conflict, the screenshot wins. Treat the briefing as your written instructions and the screenshot as your reference photo — you're building the landing page TO MATCH the screenshot.`
                    : '')
            contextParts.push(inspirationBlock)
        } catch {
            // Bad shape on disk — ignore silently and fall back to branding-only.
        }
    }

    // User-supplied images (logos, hero photos, screenshots, etc.) attached
    // via /api/ventures/[id]/assets. Goes near the end of the context block
    // so it sits closest to the generation directive — the LLM has fresh
    // memory of the asset URLs when writing the component.
    const landingAssetsBlock = buildLandingAssetsBlock(venture.context?.landingAssets)
    if (landingAssetsBlock) contextParts.push(landingAssetsBlock)

    const isContinuation = history.length > 0
    const userMessage = isContinuation
        ? "Continue from where you left off. Do not repeat anything already outputted. Complete the PipelineOutput JSON object strictly. The fullComponent MUST be completed fully."
        : `Generate a COMPLETE, production-quality landing page for this venture. This will be rendered as a live website — make it stunning.

${contextParts.join('\n\n')}

## Venture Focus
${sanitizeLabel(venture.name)}

${!hasResearch && !hasBranding ? '## Note\nNo prior research or branding data is available. Use your best judgment to create a compelling, modern landing page based on the venture concept. Choose appropriate colors, voice, and positioning.\n' : ''}

## Your Deliverables

1. **Sitemap** — 5 pages with detailed purpose descriptions
2. **Landing Page Copy** — Hero (headline referencing #1 pain point), 6+ features with 2-3 sentence descriptions, 3 detailed testimonials with names/titles/companies, 3 pricing tiers with 5-7 features each, 6-8 FAQ entries with full answers
3. **Full React Component** — A COMPLETE, beautiful, working React component (200+ lines) with:
   - Sticky navbar with smooth scroll links
   - Gradient hero section using brand colors
   - Feature cards with hover effects
   - Testimonial carousel or grid
   - Pricing comparison table with highlighted recommended tier
   - FAQ accordion with useState toggle
   - Lead capture form (email input, validation, success state)
   - Professional footer
   - Mobile responsive (Tailwind breakpoints)
   - Scroll animations using IntersectionObserver
   - Use ONLY Tailwind CSS classes, React hooks (useState, useEffect, useRef) — no imports
4. **SEO Metadata** — Title (under 60 chars), description (under 160 chars), 8-12 keywords

CRITICAL: The fullComponent must be a COMPLETE working React component. Start with "function LandingPage()" and include ALL sections. This renders as a real live page.

Output the complete PipelineOutput JSON.`

    // ── Detect edit mode: existing landing page + not a continuation resume ────
    const existingLanding = venture.context.landing as PipelineOutput | null | undefined
    const isEditMode = !isContinuation && !!existingLanding?.fullComponent && existingLanding.fullComponent.length > 100

    const run = async () => {
        const model = getFlashModel()
        const branding = venture.context.branding as Record<string, any> | undefined

        // ── EDIT MODE: surgical patch instead of full regeneration ────────────
        if (isEditMode) {
            await onStream('[Edit mode] Applying surgical changes to existing landing page...\n')

            // Build compact context: structured copy + truncated component
            const componentPreview = existingLanding!.fullComponent.length > 1200
                ? existingLanding!.fullComponent.slice(0, 600) + '\n// ... [' + (existingLanding!.fullComponent.length - 1200) + ' chars truncated] ...\n' + existingLanding!.fullComponent.slice(-600)
                : existingLanding!.fullComponent
            const existingForContext = {
                sitemap: existingLanding!.sitemap,
                landingPageCopy: existingLanding!.landingPageCopy,
                seoMetadata: existingLanding!.seoMetadata,
                fullComponent: componentPreview,
            }

            // If inspiration tokens were applied since the existing landing was
            // generated, fold the briefing into the edit message so the LLM
            // restyles surfaces / motion / typography to match the inspiration
            // instead of just doing a copy-only patch.
            const editInspirationBlock = inspirationBlock
                ? `\n\n${inspirationBlock}\n\nIf the existing component does not yet match this directive (e.g. wrong gradient strategy, wrong card surface, wrong typography rhythm), output the FULL updated fullComponent so the page actually adopts the inspiration's feel — not just a surgical copy edit.`
                : ''

            // User-uploaded images: include the same block in edit mode so
            // "swap the hero", "add my logo to the navbar", "use my
            // screenshot in the features section" requests have the actual
            // URLs to work with. If the founder asks to USE an asset, the
            // LLM must emit a fullComponent patch — copy-only patches can't
            // add new <img> tags.
            const editAssetsBlock = landingAssetsBlock
                ? `\n\n${landingAssetsBlock}\n\nIf the founder's request involves ADDING, SWAPPING, or REMOVING any image, you MUST output a fullComponent (not a copy-only patch) so the <img> / background-image references actually change.`
                : ''

            const editUserMessage = `## Edit Request\n${sanitizeLabel(venture.name)}\n\n## Current Landing Page Data\n\`\`\`json\n${JSON.stringify(existingForContext, null, 2)}\n\`\`\`${editInspirationBlock}${editAssetsBlock}\n\nApply the requested change. Output ONLY the fields that need to change as a JSON patch.`

            let fullText = ''
            await streamPrompt(
                model,
                EDIT_SYSTEM_PROMPT,
                editUserMessage,
                async (chunk) => {
                    fullText += chunk
                    await onStream(chunk)
                },
                history,
                // Pass through the reference screenshot(s) so edit-mode also
                // gets visual grounding — useful when the founder applies
                // tokens after the landing was already generated and wants
                // the next edit to actually adopt the inspiration's feel.
                inspirationImages,
            )

            const rawPatch = extractJSON(fullText) as PipelineEditPatch
            const validatedPatch = PipelineEditPatchSchema.parse(rawPatch)

            // Safety: if the patch's fullComponent is broken, keep the existing one
            if (validatedPatch.fullComponent !== undefined && !isRenderableLandingComponent(validatedPatch.fullComponent)) {
                validatedPatch.fullComponent = undefined // discard broken component, keep existing
                await onStream('\n[Edit mode] Component patch was invalid — keeping existing component.\n')
            }

            const merged = mergePatch(existingLanding!, validatedPatch)

            // If patch changed copy/SEO but NOT fullComponent, surgically replace text in existing component
            if (!validatedPatch.fullComponent && (validatedPatch.landingPageCopy || validatedPatch.seoMetadata)) {
                let updatedComponent = existingLanding!.fullComponent
                const oldCopy = existingLanding!.landingPageCopy
                const newCopy = merged.landingPageCopy

                // Replace hero text
                if (newCopy.hero.headline !== oldCopy.hero.headline)
                    updatedComponent = updatedComponent.replaceAll(oldCopy.hero.headline, newCopy.hero.headline)
                if (newCopy.hero.subheadline !== oldCopy.hero.subheadline)
                    updatedComponent = updatedComponent.replaceAll(oldCopy.hero.subheadline, newCopy.hero.subheadline)
                if (newCopy.hero.ctaPrimary !== oldCopy.hero.ctaPrimary)
                    updatedComponent = updatedComponent.replaceAll(oldCopy.hero.ctaPrimary, newCopy.hero.ctaPrimary)
                if (newCopy.hero.ctaSecondary !== oldCopy.hero.ctaSecondary)
                    updatedComponent = updatedComponent.replaceAll(oldCopy.hero.ctaSecondary, newCopy.hero.ctaSecondary)

                // Replace feature titles and descriptions
                if (validatedPatch.landingPageCopy?.features) {
                    for (let i = 0; i < oldCopy.features.length && i < newCopy.features.length; i++) {
                        if (oldCopy.features[i].title !== newCopy.features[i].title)
                            updatedComponent = updatedComponent.replaceAll(oldCopy.features[i].title, newCopy.features[i].title)
                        if (oldCopy.features[i].description !== newCopy.features[i].description)
                            updatedComponent = updatedComponent.replaceAll(oldCopy.features[i].description, newCopy.features[i].description)
                    }
                }

                // Replace pricing tier names and prices
                if (validatedPatch.landingPageCopy?.pricing) {
                    for (let i = 0; i < oldCopy.pricing.length && i < newCopy.pricing.length; i++) {
                        if (oldCopy.pricing[i].tier !== newCopy.pricing[i].tier)
                            updatedComponent = updatedComponent.replaceAll(oldCopy.pricing[i].tier, newCopy.pricing[i].tier)
                        if (oldCopy.pricing[i].price !== newCopy.pricing[i].price)
                            updatedComponent = updatedComponent.replaceAll(oldCopy.pricing[i].price, newCopy.pricing[i].price)
                        if (oldCopy.pricing[i].cta !== newCopy.pricing[i].cta)
                            updatedComponent = updatedComponent.replaceAll(oldCopy.pricing[i].cta, newCopy.pricing[i].cta)
                    }
                }

                // Replace FAQ questions and answers
                if (validatedPatch.landingPageCopy?.faq) {
                    for (let i = 0; i < oldCopy.faq.length && i < newCopy.faq.length; i++) {
                        if (oldCopy.faq[i].question !== newCopy.faq[i].question)
                            updatedComponent = updatedComponent.replaceAll(oldCopy.faq[i].question, newCopy.faq[i].question)
                        if (oldCopy.faq[i].answer !== newCopy.faq[i].answer)
                            updatedComponent = updatedComponent.replaceAll(oldCopy.faq[i].answer, newCopy.faq[i].answer)
                    }
                }

                // Replace SEO metadata
                if (validatedPatch.seoMetadata?.title && existingLanding!.seoMetadata?.title)
                    updatedComponent = updatedComponent.replaceAll(existingLanding!.seoMetadata.title, merged.seoMetadata.title)
                if (validatedPatch.seoMetadata?.description && existingLanding!.seoMetadata?.description)
                    updatedComponent = updatedComponent.replaceAll(existingLanding!.seoMetadata.description, merged.seoMetadata.description)

                merged.fullComponent = updatedComponent
                await onStream('\n[Edit mode] Applied surgical text replacement — no full regeneration needed.\n')
            }

            const validated = PipelineOutputSchema.parse(merged)

            validated.fullComponent = resolveLandingComponent({
                ventureName: branding?.brandName || venture.name,
                fullComponent: validated.fullComponent,
                landingPageCopy: validated.landingPageCopy,
                seoMetadata: validated.seoMetadata,
                colorPalette: branding?.colorPalette,
            })

            // Static validation: catch forbidden patterns + auto-sanitize
            // before the component reaches the iframe.
            const editValidation = await runComponentValidator(
                validated.fullComponent,
                onStream,
                'Edit mode',
            )
            validated.fullComponent = editValidation.sanitized

            validated.deploymentUrl = await deployLandingPage(venture.ventureId, validated)
            validated.leadCaptureActive = true
            validated.analyticsActive = false

            await onComplete(validated)
            return
        }

        // ── INITIAL GENERATION: full PipelineOutput (existing behavior) ──────
        let fullText = (history.find(h => h.role === 'model')?.parts[0] as any)?.text || ''

        await streamPrompt(
            model,
            SYSTEM_PROMPT,
            userMessage,
            async (chunk) => {
                fullText += chunk
                await onStream(chunk)
            },
            history,
            // Attach the inspiration screenshot(s) for multimodal grounding.
            // The React generator targets the visual directly, not just text.
            inspirationImages,
        )

        const raw = extractJSON(fullText) as PipelineOutput
        const validated = PipelineOutputSchema.parse(raw)

        validated.fullComponent = resolveLandingComponent({
            ventureName: branding?.brandName || venture.name,
            fullComponent: validated.fullComponent,
            landingPageCopy: validated.landingPageCopy,
            seoMetadata: validated.seoMetadata,
            colorPalette: branding?.colorPalette,
        })

        // Static validation: catch forbidden patterns + auto-sanitize before
        // the component reaches the iframe. Issues are streamed to the
        // founder so they can see what was fixed and what still needs work.
        const initialValidation = await runComponentValidator(
            validated.fullComponent,
            onStream,
            'Initial generation',
        )
        validated.fullComponent = initialValidation.sanitized

        // Post-process: wire deployment and flags
        validated.deploymentUrl = await deployLandingPage(venture.ventureId, validated)
        validated.leadCaptureActive = true
        validated.analyticsActive = true // wire later

        await onComplete(validated)
    }

    await withRetry(() => withTimeout(run(), Number(process.env.PIPELINE_TIMEOUT_MS ?? process.env.AGENT_TIMEOUT_MS ?? 180000)))
}
