type LandingHero = {
  headline?: unknown
  subheadline?: unknown
  ctaPrimary?: unknown
  ctaSecondary?: unknown
}

type LandingFeature = {
  title?: unknown
  description?: unknown
  icon?: unknown
}

type LandingPricingTier = {
  tier?: unknown
  price?: unknown
  features?: unknown
  cta?: unknown
}

type LandingFaq = {
  question?: unknown
  answer?: unknown
}

type LandingPageCopy = {
  hero?: LandingHero
  features?: LandingFeature[]
  socialProof?: unknown
  pricing?: LandingPricingTier[]
  faq?: LandingFaq[]
}

type SeoMetadata = {
  title?: unknown
  description?: unknown
  keywords?: unknown
}

const FALLBACK_COLORS = ['#0f172a', '#2563eb', '#14b8a6']
const LANDING_PLACEHOLDER_PATTERNS = [
  /landing page pending/i,
  /component not found/i,
]

export function stripGeneratedCodeFences(code: unknown): string {
  if (typeof code !== 'string') return ''

  return code
    .replace(/```(?:tsx|jsx|html|javascript|typescript)?\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

export function isRenderableLandingComponent(code: unknown): code is string {
  const clean = stripGeneratedCodeFences(code)
  if (!clean) return false
  if (LANDING_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(clean))) return false

  const looksLikeComponent =
    /export\s+default/i.test(clean) ||
    /function\s+[A-Z_a-z][\w$]*\s*\(/.test(clean) ||
    /const\s+[A-Z_a-z][\w$]*\s*=\s*\(/.test(clean) ||
    /const\s+[A-Z_a-z][\w$]*\s*=\s*\(\)\s*=>/.test(clean) ||
    /\buseState\b/.test(clean)

  const looksLikeMarkup = /<[A-Za-z][\s\S]*>/.test(clean)

  return looksLikeComponent || looksLikeMarkup
}

export function resolveLandingComponent(input: {
  ventureName?: string
  fullComponent?: unknown
  landingPageCopy?: LandingPageCopy | null
  seoMetadata?: SeoMetadata | null
  colorPalette?: unknown
}): string {
  const clean = stripGeneratedCodeFences(input.fullComponent)
  if (isRenderableLandingComponent(clean)) return clean

  return buildFallbackLandingComponent({
    ventureName: input.ventureName,
    landingPageCopy: input.landingPageCopy,
    seoMetadata: input.seoMetadata,
    colorPalette: input.colorPalette,
  })
}

function buildFallbackLandingComponent(input: {
  ventureName?: string
  landingPageCopy?: LandingPageCopy | null
  seoMetadata?: SeoMetadata | null
  colorPalette?: unknown
}): string {
  const ventureName = sanitizeVentureName(input.ventureName)
  const copy = input.landingPageCopy ?? {}
  const hero = copy.hero ?? {}

  const headline = stringOrFallback(hero.headline, `Launch ${ventureName} with confidence`)
  const subheadline = stringOrFallback(
    hero.subheadline,
    'A polished landing page fallback was generated automatically so your launch preview stays usable.'
  )
  const ctaPrimary = stringOrFallback(hero.ctaPrimary, 'Join the waitlist')
  const ctaSecondary = stringOrFallback(hero.ctaSecondary, 'See pricing')

  const features = normalizeFeatures(copy.features)
  const testimonials = normalizeTestimonials(copy.socialProof)
  const pricing = normalizePricing(copy.pricing)
  const faq = normalizeFaq(copy.faq)
  const seo = input.seoMetadata ?? {}
  const metaTitle = stringOrFallback(seo.title, ventureName)
  const metaDescription = stringOrFallback(
    seo.description,
    `${ventureName} is ready for a clean launch preview while the full generated page is being finalized.`
  )
  const keywords = normalizeKeywords(seo.keywords)
  const [bgColor, primaryColor, accentColor] = extractPalette(input.colorPalette)

  return [
    'function LandingPage() {',
    `  const hero = ${JSON.stringify({ headline, subheadline, ctaPrimary, ctaSecondary })};`,
    `  const features = ${JSON.stringify(features)};`,
    `  const testimonials = ${JSON.stringify(testimonials)};`,
    `  const pricing = ${JSON.stringify(pricing)};`,
    `  const faq = ${JSON.stringify(faq)};`,
    `  const meta = ${JSON.stringify({ title: metaTitle, description: metaDescription, keywords })};`,
    `  const palette = ${JSON.stringify({ bgColor, primaryColor, accentColor })};`,
    '  const [email, setEmail] = useState("");',
    '  const [error, setError] = useState("");',
    '  const [submitted, setSubmitted] = useState(false);',
    '  const [openFaq, setOpenFaq] = useState(0);',
    '  const year = new Date().getFullYear();',
    '',
    '  const handleSubmit = (event) => {',
    '    event.preventDefault();',
    '    const nextEmail = email.trim();',
    '    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(nextEmail)) {',
    '      setSubmitted(false);',
    '      setError("Enter a valid email address.");',
    '      return;',
    '    }',
    '    setError("");',
    '    setSubmitted(true);',
    '    setEmail("");',
    '  };',
    '',
    '  return (',
    '    <div className="min-h-screen bg-slate-950 text-slate-100">',
    '      <style>{`:root{--lp-bg:${palette.bgColor};--lp-primary:${palette.primaryColor};--lp-accent:${palette.accentColor};} html{scroll-behavior:smooth;}`}</style>',
    '      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">',
    '        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">',
    '          <a href="#top" className="text-sm font-semibold tracking-[0.24em] text-white/80 uppercase">{meta.title}</a>',
    '          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">',
    '            <a href="#features" className="transition hover:text-white">Features</a>',
    '            <a href="#testimonials" className="transition hover:text-white">Proof</a>',
    '            <a href="#pricing" className="transition hover:text-white">Pricing</a>',
    '            <a href="#faq" className="transition hover:text-white">FAQ</a>',
    '          </nav>',
    '          <a',
    '            href="#signup"',
    '            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:opacity-90"',
    '            style={{ backgroundColor: "var(--lp-accent)" }}',
    '          >',
    '            {hero.ctaPrimary}',
    '          </a>',
    '        </div>',
    '      </header>',
    '',
    '      <main id="top">',
    '        <section className="relative overflow-hidden">',
    '          <div className="absolute inset-0 opacity-90" style={{ background: `radial-gradient(circle at top left, ${palette.primaryColor}55, transparent 38%), radial-gradient(circle at top right, ${palette.accentColor}40, transparent 34%), linear-gradient(135deg, ${palette.bgColor} 0%, #020617 60%, #020617 100%)` }} />',
    '          <div className="relative mx-auto grid min-h-[88vh] max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">',
    '            <div className="max-w-2xl">',
    '              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Launch Preview Ready</p>',
    '              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">{hero.headline}</h1>',
    '              <p className="mt-6 max-w-xl text-base leading-8 text-white/70 sm:text-lg">{hero.subheadline}</p>',
    '              <div className="mt-8 flex flex-col gap-3 sm:flex-row">',
    '                <a',
    '                  href="#signup"',
    '                  className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-slate-950 shadow-xl transition hover:translate-y-[-1px]"',
    '                  style={{ backgroundColor: "var(--lp-accent)" }}',
    '                >',
    '                  {hero.ctaPrimary}',
    '                </a>',
    '                <a href="#pricing" className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10">{hero.ctaSecondary}</a>',
    '              </div>',
    '              <div className="mt-10 grid gap-3 text-sm text-white/70 sm:grid-cols-3">',
    '                {features.slice(0, 3).map((feature) => (',
    '                  <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-md">',
    '                    <div className="text-lg">{feature.icon}</div>',
    '                    <div className="mt-2 font-semibold text-white">{feature.title}</div>',
    '                  </div>',
    '                ))}',
    '              </div>',
    '            </div>',
    '            <div className="rounded-[28px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">',
    '              <div className="rounded-[24px] border border-white/10 bg-slate-950/80 p-6">',
    '                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/50">Why this fallback exists</p>',
    '                <h2 className="mt-4 text-2xl font-semibold text-white">Your launch page stays live even when AI output is incomplete.</h2>',
    '                <p className="mt-4 text-sm leading-7 text-white/70">{meta.description}</p>',
    '                <ul className="mt-6 space-y-3 text-sm text-white/70">',
    '                  <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Structured copy is still surfaced from the landing module output.</li>',
    '                  <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Visitors can keep signing up while the richer generated page is retried.</li>',
    '                  <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">The dashboard preview and live route now resolve the same component safely.</li>',
    '                </ul>',
    '              </div>',
    '            </div>',
    '          </div>',
    '        </section>',
    '',
    '        <section id="features" className="bg-white px-4 py-24 text-slate-900 sm:px-6 lg:px-8">',
    '          <div className="mx-auto max-w-6xl">',
    '            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Features</p>',
    '            <div className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Everything the launch page needs to stay useful.</div>',
    '            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">',
    '              {features.map((feature) => (',
    '                <article key={feature.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">',
    '                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-xl text-white" style={{ backgroundColor: "var(--lp-primary)" }}>{feature.icon}</div>',
    '                  <h3 className="mt-5 text-xl font-semibold text-slate-950">{feature.title}</h3>',
    '                  <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>',
    '                </article>',
    '              ))}',
    '            </div>',
    '          </div>',
    '        </section>',
    '',
    '        <section id="testimonials" className="bg-slate-100 px-4 py-24 text-slate-900 sm:px-6 lg:px-8">',
    '          <div className="mx-auto max-w-6xl">',
    '            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Proof</p>',
    '            <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Even the fallback tells the story clearly.</div>',
    '            <div className="mt-12 grid gap-6 lg:grid-cols-3">',
    '              {testimonials.map((testimonial, index) => (',
    '                <article key={`${testimonial.name}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">',
    '                  <div className="text-3xl leading-none" style={{ color: "var(--lp-accent)" }}>"</div>',
    '                  <p className="mt-4 text-sm leading-7 text-slate-600">{testimonial.quote}</p>',
    '                  <div className="mt-6 text-sm font-semibold text-slate-950">{testimonial.name}</div>',
    '                  <div className="text-sm text-slate-500">{testimonial.role}</div>',
    '                </article>',
    '              ))}',
    '            </div>',
    '          </div>',
    '        </section>',
    '',
    '        <section id="pricing" className="bg-slate-950 px-4 py-24 sm:px-6 lg:px-8">',
    '          <div className="mx-auto max-w-6xl">',
    '            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">Pricing</p>',
    '            <div className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">A working pricing section is available immediately.</div>',
    '            <div className="mt-12 grid gap-6 xl:grid-cols-3">',
    '              {pricing.map((tier, index) => {',
    '                const highlighted = index === 1 || (pricing.length === 1 && index === 0);',
    '                return (',
    '                  <article',
    '                    key={tier.tier}',
    '                    className={`rounded-3xl border p-6 shadow-xl ${highlighted ? "border-transparent bg-white text-slate-950" : "border-white/10 bg-white/5 text-white"}`}',
    '                    style={highlighted ? { boxShadow: `0 20px 60px ${palette.accentColor}33` } : undefined}',
    '                  >',
    '                    <div className="flex items-center justify-between gap-4">',
    '                      <h3 className="text-xl font-semibold">{tier.tier}</h3>',
    '                      {highlighted ? <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950" style={{ backgroundColor: "var(--lp-accent)" }}>Popular</span> : null}',
    '                    </div>',
    '                    <div className="mt-6 text-4xl font-semibold tracking-tight">{tier.price}</div>',
    '                    <ul className="mt-6 space-y-3 text-sm leading-7">',
    '                      {tier.features.map((feature) => (',
    '                        <li key={feature} className="flex gap-3"><span style={{ color: "var(--lp-accent)" }}>-</span><span>{feature}</span></li>',
    '                      ))}',
    '                    </ul>',
    '                    <a',
    '                      href="#signup"',
    '                      className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition hover:opacity-90 ${highlighted ? "text-slate-950" : "bg-white text-slate-950"}`}',
    '                      style={highlighted ? { backgroundColor: "var(--lp-accent)" } : undefined}',
    '                    >',
    '                      {tier.cta}',
    '                    </a>',
    '                  </article>',
    '                );',
    '              })}',
    '            </div>',
    '          </div>',
    '        </section>',
    '',
    '        <section id="faq" className="bg-white px-4 py-24 text-slate-900 sm:px-6 lg:px-8">',
    '          <div className="mx-auto max-w-4xl">',
    '            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">FAQ</p>',
    '            <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Questions are still answered while generation is retried.</div>',
    '            <div className="mt-12 space-y-4">',
    '              {faq.map((item, index) => {',
    '                const isOpen = openFaq === index;',
    '                return (',
    '                  <div key={item.question} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">',
    '                    <button',
    '                      type="button"',
    '                      onClick={() => setOpenFaq(isOpen ? -1 : index)}',
    '                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"',
    '                    >',
    '                      <span className="text-base font-semibold text-slate-950">{item.question}</span>',
    '                      <span className="text-xl" style={{ color: "var(--lp-primary)" }}>{isOpen ? "-" : "+"}</span>',
    '                    </button>',
    '                    {isOpen ? <div className="px-6 pb-6 text-sm leading-7 text-slate-600">{item.answer}</div> : null}',
    '                  </div>',
    '                );',
    '              })}',
    '            </div>',
    '          </div>',
    '        </section>',
    '',
    '        <section id="signup" className="bg-slate-100 px-4 py-24 text-slate-900 sm:px-6 lg:px-8">',
    '          <div className="mx-auto grid max-w-6xl gap-10 rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl lg:grid-cols-[1fr_0.9fr] lg:p-12">',
    '            <div>',
    '              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Lead Capture</p>',
    '              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Collect signups now instead of waiting on a rerun.</h2>',
    '              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">This fallback keeps a polished signup flow online. Once the richer generated page succeeds, the same launch route will serve it automatically.</p>',
    '              <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">',
    '                {meta.keywords.slice(0, 4).map((keyword) => (',
    '                  <span key={keyword} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2">{keyword}</span>',
    '                ))}',
    '              </div>',
    '            </div>',
    '            <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-sm">',
    '              <label htmlFor="email" className="text-sm font-semibold text-slate-950">Work email</label>',
    '              <input',
    '                id="email"',
    '                type="email"',
    '                value={email}',
    '                onChange={(event) => setEmail(event.target.value)}',
    '                placeholder="you@company.com"',
    '                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"',
    '              />',
    '              {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}',
    '              {submitted ? <p className="mt-3 text-sm text-emerald-600">Thanks. Your signup was captured in demo mode.</p> : null}',
    '              <button',
    '                type="submit"',
    '                className="mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:opacity-90"',
    '                style={{ backgroundColor: "var(--lp-accent)" }}',
    '              >',
    '                {hero.ctaPrimary}',
    '              </button>',
    '              <p className="mt-3 text-xs leading-6 text-slate-500">No spam. This form intentionally runs in preview-safe demo mode.</p>',
    '            </form>',
    '          </div>',
    '        </section>',
    '      </main>',
    '',
    '      <footer className="border-t border-white/10 bg-slate-950 px-4 py-10 text-sm text-white/60 sm:px-6 lg:px-8">',
    '        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">',
    '          <div>{meta.title}</div>',
    '          <div>(c) {year} {meta.title}. Preview served by Forze.</div>',
    '        </div>',
    '      </footer>',
    '',
    '      <a',
    '        href="https://tryForze.ai"',
    '        target="_blank"',
    '        rel="noreferrer"',
    '        style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 9999, display: "flex", alignItems: "center", gap: "6px", background: "rgba(0,0,0,0.85)", color: "white", fontSize: "11px", fontWeight: 500, padding: "7px 14px", borderRadius: "20px", textDecoration: "none", backdropFilter: "blur(10px)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}',
    '      >',
    '        Built with Forze',
    '      </a>',
    '    </div>',
    '  );',
    '}',
  ].join('\n')
}

function sanitizeVentureName(name: string | undefined): string {
  const base = stringOrFallback(name, 'Your Venture')
    .split('\n')[0]
    .split(':')[0]
    .trim()

  return base || 'Your Venture'
}

function stringOrFallback(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const clean = value.trim()
  return clean || fallback
}

function normalizeFeatures(features: LandingFeature[] | undefined): Array<{ title: string; description: string; icon: string }> {
  const normalized = Array.isArray(features)
    ? features
        .map((feature, index) => ({
          title: stringOrFallback(feature?.title, `Feature ${index + 1}`),
          description: stringOrFallback(
            feature?.description,
            'This section stays online with clear messaging even when the richer generated component needs another pass.'
          ),
          icon: stringOrFallback(feature?.icon, index % 2 === 0 ? '*' : 'o'),
        }))
        .filter((feature) => feature.title || feature.description)
    : []

  if (normalized.length >= 3) return normalized.slice(0, 6)

  return [
    ...normalized,
    {
      title: 'Launch-safe fallback',
      description: 'Preview and live launch routes now resolve a safe landing page instead of publishing placeholder output.',
      icon: '*',
    },
    {
      title: 'Structured content preserved',
      description: 'Hero copy, pricing, testimonials, and FAQs are still shown using the landing module data that already exists.',
      icon: 'o',
    },
    {
      title: 'Retry-friendly pipeline',
      description: 'When the AI returns incomplete component code, Forze can recover without taking your launch page down.',
      icon: '^',
    },
  ].slice(0, 3)
}

function normalizeTestimonials(socialProof: unknown): Array<{ quote: string; name: string; role: string }> {
  const items = Array.isArray(socialProof) ? socialProof : []

  const normalized = items
    .map((item, index) => {
      const raw = typeof item === 'string' ? item.trim() : ''
      if (!raw) return null

      const parts = raw.split(' - ')
      const quote = parts[0]?.replace(/^"+|"+$/g, '').trim() || raw
      const attribution = parts[1]?.trim() || `Customer ${index + 1}, Early Access`
      return {
        quote,
        name: attribution.split(',')[0]?.trim() || `Customer ${index + 1}`,
        role: attribution.split(',').slice(1).join(',').trim() || 'Early Access',
      }
    })
    .filter((item): item is { quote: string; name: string; role: string } => Boolean(item))

  if (normalized.length > 0) return normalized.slice(0, 3)

  return [
    {
      quote: 'We could keep sharing a live page instead of apologizing for a broken launch preview.',
      name: 'Avery Shah',
      role: 'Founder, Early Access',
    },
    {
      quote: 'The fallback kept our landing page readable, on-brand, and ready for signups while the richer version retried.',
      name: 'Maya Reed',
      role: 'Growth Lead, Beta Team',
    },
    {
      quote: 'It solved the exact failure mode that used to publish a placeholder page instead of a usable site.',
      name: 'Jordan Kim',
      role: 'Product Operator, Launch Crew',
    },
  ]
}

function normalizePricing(pricing: LandingPricingTier[] | undefined): Array<{ tier: string; price: string; features: string[]; cta: string }> {
  const normalized = Array.isArray(pricing)
    ? pricing
        .map((tier, index) => ({
          tier: stringOrFallback(tier?.tier, `Tier ${index + 1}`),
          price: stringOrFallback(tier?.price, index === 0 ? '$0' : '$29'),
          features: normalizeStringList(tier?.features, [
            'Live launch page',
            'Lead capture form',
            'FAQ section',
            'Pricing block',
          ]),
          cta: stringOrFallback(tier?.cta, 'Get started'),
        }))
        .filter((tier) => tier.tier)
    : []

  if (normalized.length > 0) return normalized.slice(0, 3)

  return [
    {
      tier: 'Starter',
      price: '$0',
      features: ['Launch-safe fallback page', 'Responsive hero section', 'Preview-safe signup form', 'Live route support'],
      cta: 'Start free',
    },
    {
      tier: 'Growth',
      price: '$29',
      features: ['Everything in Starter', 'Testimonials and pricing', 'Structured FAQ accordion', 'Retry-friendly generation flow'],
      cta: 'Choose growth',
    },
    {
      tier: 'Scale',
      price: '$99',
      features: ['Everything in Growth', 'Priority reruns', 'Advanced landing customization', 'Deeper experiment support'],
      cta: 'Talk to us',
    },
  ]
}

function normalizeFaq(faq: LandingFaq[] | undefined): Array<{ question: string; answer: string }> {
  const normalized = Array.isArray(faq)
    ? faq
        .map((item) => ({
          question: stringOrFallback(item?.question, ''),
          answer: stringOrFallback(
            item?.answer,
            'Forze keeps a polished fallback live so visitors still see a complete page while the full generated component is retried.'
          ),
        }))
        .filter((item) => item.question)
    : []

  if (normalized.length > 0) return normalized.slice(0, 6)

  return [
    {
      question: 'Why am I seeing this version of the landing page?',
      answer: 'This fallback appears when the generated component output is incomplete or placeholder-only. It keeps the launch URL usable instead of showing a broken page.',
    },
    {
      question: 'Can visitors still sign up?',
      answer: 'Yes. The lead capture form stays visible so the page remains useful during retries or while generation is repaired.',
    },
    {
      question: 'Will the richer generated page replace this automatically?',
      answer: 'Yes. As soon as a valid landing component is available, the same preview and launch routes can render it without changing your link.',
    },
  ]
}

function normalizeKeywords(keywords: unknown): string[] {
  const normalized = Array.isArray(keywords)
    ? keywords
        .map((keyword) => (typeof keyword === 'string' ? keyword.trim() : ''))
        .filter(Boolean)
    : []

  return normalized.length > 0
    ? normalized.slice(0, 8)
    : ['startup launch', 'landing page', 'product validation', 'waitlist', 'conversion', 'go to market']
}

function normalizeStringList(value: unknown, fallback: string[]): string[] {
  const normalized = Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    : []

  return normalized.length > 0 ? normalized.slice(0, 6) : fallback
}

function extractPalette(colorPalette: unknown): [string, string, string] {
  const colors = Array.isArray(colorPalette)
    ? colorPalette
        .map((item) => {
          if (typeof item === 'string') return item.trim()
          if (item && typeof item === 'object') {
            const candidate = (item as { hex?: unknown; code?: unknown }).hex ?? (item as { code?: unknown }).code
            return typeof candidate === 'string' ? candidate.trim() : ''
          }
          return ''
        })
        .filter((color) => /^#(?:[0-9a-f]{3}){1,2}$/i.test(color))
    : []

  return [
    colors[0] ?? FALLBACK_COLORS[0],
    colors[1] ?? FALLBACK_COLORS[1],
    colors[2] ?? FALLBACK_COLORS[2],
  ]
}
