// lib/inspiration/html-scrape.ts
//
// Cheap, dependency-free scraper that reads the live HTML of an inspiration
// URL and extracts ground-truth design signals that Gemini cannot reliably
// recover from a screenshot:
//
//   • Real font families — from Google Fonts links, Typekit/Adobe Fonts hrefs,
//     <link> rel="preload" as="font", and inline @font-face declarations
//   • CSS custom properties — :root { --primary: #635bff; --radius: 8px }
//   • Inline colours referenced via style="" attributes (last-ditch)
//
// Output is an ordered structured object the analyze route can hand to Gemini
// as authoritative ("these are real, do not override").
//
// We deliberately do NOT follow external <link rel="stylesheet"> URLs — that
// would multiply latency and most sites bundle CSS through hashed asset URLs
// (next.js / webpack) that don't expose useful variable names anyway. The
// high-leverage targets (Google Fonts hrefs, inline @font-face, :root vars)
// are all in the HTML document we already fetch for og:image parsing.

import { isSafeRemoteUrl } from '@/lib/inspiration/screenshot'

const HTML_TIMEOUT_MS = 8_000
const MAX_HTML_BYTES = 800_000 // 800 KB — covers anything you'd actually want to inspect

const DEFAULT_HEADERS: Record<string, string> = {
    'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
}

export interface ScrapedTokens {
    fonts: {
        heading?: string // best guess at the primary display/body font
        body?: string
        mono?: string
        // All font families detected, in declaration order. Useful evidence
        // even when we can't tell which slot they fill.
        allFamilies: string[]
        // Which scraping path each family came from — helpful when debugging.
        sources: Array<{ family: string; source: 'google-fonts' | 'typekit' | 'font-face' | 'css-font-family' | 'preload' }>
    }
    cssVariables: Record<string, string>
    // Hex codes referenced in inline style="" attributes — last-resort signal.
    inlineColors: string[]
    // The raw <title> + meta description, useful for tone inference.
    title?: string
    description?: string
    // The HTML's primary lang attribute, helps if Gemini ever needs to
    // generate non-English copy.
    lang?: string
}

export async function scrapeHtmlTokens(url: string): Promise<ScrapedTokens | null> {
    if (!isSafeRemoteUrl(url)) return null
    const html = await fetchHtml(url)
    if (!html) return null

    const sources: ScrapedTokens['fonts']['sources'] = []
    const allFamilies = new Set<string>()

    // 1) Google Fonts — most common path on indie + SaaS sites.
    //    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono">
    const googleHrefs = matchAll(
        html,
        /<link[^>]+href=["']https:\/\/fonts\.googleapis\.com\/[^"']*["'][^>]*>/gi,
    )
    for (const tag of googleHrefs) {
        const hrefMatch = /href=["']([^"']+)["']/i.exec(tag)
        if (!hrefMatch) continue
        try {
            const u = new URL(hrefMatch[1])
            // Both ?family= and the /css2 path accept multiple &family= entries.
            const families = u.searchParams.getAll('family')
            for (const f of families) {
                // "Inter:wght@400;600" → "Inter"
                const name = f.split(':')[0].replace(/\+/g, ' ').trim()
                if (name) {
                    allFamilies.add(name)
                    sources.push({ family: name, source: 'google-fonts' })
                }
            }
        } catch {
            // ignore malformed href
        }
    }

    // 2) Typekit / Adobe Fonts — <link href="https://use.typekit.net/abc.css">
    //    The CSS itself names the families but we don't fetch external CSS;
    //    however many sites also ship a typekit projectId comment we can mine.
    const typekitHrefs = matchAll(
        html,
        /<link[^>]+href=["']https:\/\/use\.typekit\.net\/[^"']+["'][^>]*>/gi,
    )
    if (typekitHrefs.length > 0) {
        // We can't recover the specific family from the href alone, but the
        // presence of typekit is a strong signal the site uses paid display
        // fonts — record it so the studio can show "Typekit fonts detected".
        sources.push({ family: 'Adobe Typekit (custom)', source: 'typekit' })
        allFamilies.add('Adobe Typekit (custom)')
    }

    // 3) @font-face declarations inside inline <style> blocks.
    //    @font-face { font-family: 'Söhne'; src: url(...) }
    const styleBlocks = matchAll(html, /<style[^>]*>([\s\S]*?)<\/style>/gi).map((m) => stripStyleTag(m))
    const allStyle = styleBlocks.join('\n')
    const faceFamilies = matchAll(allStyle, /@font-face[^{]*\{[^}]*font-family:\s*['"]?([^'";}\s]+)['"]?[^}]*\}/gi)
    for (const block of faceFamilies) {
        const nameMatch = /font-family:\s*['"]?([^'";}\s]+)['"]?/i.exec(block)
        if (nameMatch) {
            const name = nameMatch[1].trim()
            allFamilies.add(name)
            sources.push({ family: name, source: 'font-face' })
        }
    }

    // 4) <link rel="preload" as="font" href="...woff2"> — the URL filename
    //    often contains the family ("Sohne-Regular.woff2" → Söhne).
    const preloadFonts = matchAll(html, /<link[^>]+rel=["']preload["'][^>]+as=["']font["'][^>]+href=["']([^"']+)["'][^>]*>/gi)
    for (const tag of preloadFonts) {
        const m = /href=["']([^"']+)["']/i.exec(tag)
        if (!m) continue
        const filename = m[1].split('/').pop() ?? ''
        const guessed = /([A-Za-z][A-Za-z0-9-]+)(?:-(?:Regular|Bold|Medium|Light|SemiBold|Italic|Variable))?\.(?:woff2?|ttf|otf)/i.exec(filename)?.[1]
        if (guessed && guessed.length > 2) {
            const name = guessed.replace(/-/g, ' ')
            if (!allFamilies.has(name)) {
                allFamilies.add(name)
                sources.push({ family: name, source: 'preload' })
            }
        }
    }

    // 5) Direct `font-family: X` declarations in inline styles. Filter out
    //    the obvious system-stack fallbacks so we don't pollute the result
    //    with "system-ui, sans-serif" 50 times.
    const directFamilies = matchAll(allStyle, /font-family:\s*([^;}\n]+)[;}]/gi)
    for (const decl of directFamilies) {
        const value = /font-family:\s*([^;}\n]+)/i.exec(decl)?.[1]
        if (!value) continue
        const first = value.split(',')[0].replace(/['"]/g, '').trim()
        if (!first || isSystemFallback(first)) continue
        if (!allFamilies.has(first)) {
            allFamilies.add(first)
            sources.push({ family: first, source: 'css-font-family' })
        }
    }

    // 6) CSS custom properties — pulled from anywhere in inline <style>.
    const cssVariables: Record<string, string> = {}
    const varDecls = matchAll(allStyle, /--([a-z0-9-]+)\s*:\s*([^;{}]+)[;}]/gi)
    for (const decl of varDecls) {
        const m = /--([a-z0-9-]+)\s*:\s*([^;{}]+)/i.exec(decl)
        if (!m) continue
        const key = m[1].trim()
        const value = m[2].trim()
        // Skip variables that are just other variable references (cascade noise).
        if (/^var\(/.test(value)) continue
        cssVariables[key] = value
    }

    // 7) Inline hex/rgb colours from style="" attributes — last resort.
    const inlineColors = new Set<string>()
    const inlineStyles = matchAll(html, /style=["']([^"']*)["']/gi)
    for (const tag of inlineStyles) {
        const m = /style=["']([^"']*)["']/i.exec(tag)
        if (!m) continue
        const hexes = matchAll(m[1], /#[0-9a-f]{6}/gi)
        for (const h of hexes) inlineColors.add(h.toLowerCase())
    }

    // 8) Metadata for tone inference.
    const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html)
    const descMatch = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html)
    const langMatch = /<html[^>]+lang=["']([^"']+)["']/i.exec(html)

    // Heuristic slot assignment: first non-system family → heading + body,
    // first mono-coded family → mono. Many sites use one family for both
    // heading and body (the Inter / Geist pattern), which is fine.
    const ordered = sources.map((s) => s.family).filter((f) => !isSystemFallback(f))
    const monoCandidate = ordered.find((f) => /mono|code|jetbrains/i.test(f))
    const nonMono = ordered.filter((f) => f !== monoCandidate)
    const heading = nonMono[0]
    const body = nonMono[1] ?? nonMono[0]

    return {
        fonts: {
            heading,
            body,
            mono: monoCandidate,
            allFamilies: Array.from(allFamilies),
            sources,
        },
        cssVariables,
        inlineColors: Array.from(inlineColors).slice(0, 16),
        title: titleMatch?.[1]?.trim(),
        description: descMatch?.[1]?.trim(),
        lang: langMatch?.[1]?.trim(),
    }
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), HTML_TIMEOUT_MS)
    try {
        const res = await fetch(url, { headers: DEFAULT_HEADERS, signal: controller.signal })
        if (!res.ok) return null
        const ct = res.headers.get('content-type') ?? ''
        if (!ct.includes('text/html') && !ct.includes('application/xhtml')) return null
        const body = await res.text()
        return body.slice(0, MAX_HTML_BYTES)
    } catch {
        return null
    } finally {
        clearTimeout(timer)
    }
}

function matchAll(input: string, regex: RegExp): string[] {
    const matches: string[] = []
    let m: RegExpExecArray | null
    // Defensive copy — the input regex might be stateful (global flag).
    const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g')
    while ((m = re.exec(input)) !== null) {
        matches.push(m[0])
        // Guard against zero-width matches that would infinite-loop.
        if (m.index === re.lastIndex) re.lastIndex += 1
    }
    return matches
}

function stripStyleTag(tag: string): string {
    return tag.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, '')
}

function isSystemFallback(name: string): boolean {
    const lowered = name.toLowerCase().trim()
    return (
        lowered === 'inherit' ||
        lowered === 'initial' ||
        lowered === 'unset' ||
        lowered === 'system-ui' ||
        lowered === '-apple-system' ||
        lowered === 'blinkmacsystemfont' ||
        lowered === 'sans-serif' ||
        lowered === 'serif' ||
        lowered === 'monospace' ||
        lowered === 'ui-sans-serif' ||
        lowered === 'ui-serif' ||
        lowered === 'ui-monospace' ||
        lowered === 'arial' ||
        lowered === 'helvetica' ||
        lowered === 'roboto' ||
        lowered === 'segoe ui' ||
        lowered === 'tahoma' ||
        lowered === 'verdana' ||
        lowered === 'times new roman' ||
        lowered === 'georgia' ||
        lowered === 'courier new'
    )
}
