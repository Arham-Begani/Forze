// lib/inspiration/screenshot.ts
// Fetch-based remote image capture with the same five-tier fallback ladder
// described in docs/GENERATE_FROM_INSPIRATION.md, adapted so it works on
// Vercel Functions without bundling a headless browser.
//
// Original spec assumed Playwright/Chromium for tiers 1–2. That ships as a
// ~300MB dependency that adds long cold starts and only renders correctly on
// a subset of Vercel's runtimes, so we collapse to four real tiers that the
// platform can actually execute today:
//
//   Tier 1: site's own og:image (or twitter:image) — designers curate this
//   Tier 2: largest <link rel="apple-touch-icon">                 (decent res)
//   Tier 3: favicon                                                  (16×16)
//   Tier 4: user-supplied image upload                          (final escape)
//
// The Gemini-vision pass treats whichever tier returns first as the source of
// truth — designers' og:image hits ~85% of real-world inspiration URLs, so
// quality stays high.

import { createHash } from 'crypto'

export interface CaptureResult {
    url: string
    // Tier 0 = remote browser screenshot (Microlink). Highest accuracy because
    //         it's the actual rendered hero of the live page, not a curated
    //         og:image. Comes with palette + brand-color metadata.
    tier: 0 | 1 | 2 | 3 | 4
    image: {
        data: Buffer
        contentType: string
        bytes: number
    }
    sourceUrl?: string // exact resource we ended up downloading
    // ── Tier 0 metadata (populated only when remote screenshot succeeded) ──
    // The palette is Vibrant-extracted dominant colors from the live render.
    // Feeding these to Gemini as ground truth replaces it eyeballing hex
    // codes from a JPEG, which it's bad at.
    groundTruth?: {
        palette?: string[] // hex strings, most-dominant first
        brandColor?: string // primary brand color per Vibrant
        backgroundColor?: string // page background per Vibrant
        title?: string
        description?: string
        publisher?: string
    }
}

export interface CaptureFailure {
    url: string
    error: string
}

export type CaptureOutcome = CaptureResult | CaptureFailure

export function isCaptureSuccess(o: CaptureOutcome): o is CaptureResult {
    return 'image' in o
}

// ── Public entry points ───────────────────────────────────────────────────────

export async function captureInspirationImage(
    url: string,
    options: { uploadedImage?: { dataUrl: string } | null } = {},
): Promise<CaptureOutcome> {
    if (!isSafeRemoteUrl(url)) {
        return { url, error: 'URL is not a safe public address' }
    }

    // Tier 0 — remote browser screenshot of the live page. Massively more
    // representative than og:image when og:image is just a logo card. Also
    // returns programmatically-extracted palette + brand color we can hand to
    // Gemini as ground truth instead of asking it to eyeball hex codes.
    //
    // Disabled via INSPIRATION_USE_REMOTE_SCREENSHOT=false for cost control or
    // when the upstream is down. Falls through to the existing tiers on any
    // failure so this never blocks the pipeline.
    if (process.env.INSPIRATION_USE_REMOTE_SCREENSHOT !== 'false') {
        try {
            const { captureWithMicrolink } = await import('@/lib/inspiration/remote-capture')
            const remote = await captureWithMicrolink(url)
            if (remote) {
                return {
                    url,
                    tier: 0,
                    image: remote.image,
                    sourceUrl: remote.sourceUrl,
                    groundTruth: remote.groundTruth,
                }
            }
        } catch (e) {
            console.warn('[inspiration] remote screenshot failed, falling back:', e instanceof Error ? e.message : e)
        }
    }

    // Try og:image / twitter:image first — almost always present on landing
    // pages worth taking inspiration from, and usually a hand-crafted hero shot.
    const og = await tryOgImage(url)
    if (og) return { url, tier: 1, image: og.image, sourceUrl: og.sourceUrl }

    const touch = await tryAppleTouchIcon(url)
    if (touch) return { url, tier: 2, image: touch.image, sourceUrl: touch.sourceUrl }

    const fav = await tryFavicon(url)
    if (fav) return { url, tier: 3, image: fav.image, sourceUrl: fav.sourceUrl }

    if (options.uploadedImage?.dataUrl) {
        const uploaded = decodeDataUrl(options.uploadedImage.dataUrl)
        if (uploaded) return { url, tier: 4, image: uploaded }
    }

    return { url, error: 'All capture tiers failed and no upload was provided' }
}

export function hashCacheKey(url: string): string {
    const today = new Date().toISOString().slice(0, 10) // UTC day
    return createHash('md5').update(`${url}|${today}`).digest('hex')
}

// ── URL safety ────────────────────────────────────────────────────────────────

export function isSafeRemoteUrl(url: string): boolean {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return false
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false

    const host = parsed.hostname.toLowerCase()
    if (!host) return false

    // Reject hostname forms we cannot reliably canonicalize: octal/hex/decimal
    // IPv4 (e.g. 0x7f.0.0.1, 2130706433) bypass plain regex checks and are
    // almost never used for legitimate marketing sites.
    if (/^0x/i.test(host)) return false
    if (/^[0-9]+$/.test(host)) return false

    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return false
    if (host.endsWith('.localhost') || host.endsWith('.local')) return false
    if (/^127\./.test(host)) return false
    if (/^10\./.test(host)) return false
    if (/^192\.168\./.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
    if (/^169\.254\./.test(host)) return false // AWS / GCE metadata
    // Carrier-grade NAT (RFC 6598)
    if (/^100\.6[4-9]\./.test(host) || /^100\.[7-9]\d\./.test(host) || /^100\.1[01]\d\./.test(host) || /^100\.12[0-7]\./.test(host)) return false
    // Azure IMDS host
    if (host === '168.63.129.16') return false
    // IPv6 private/link-local/ULA ranges in bracketed form
    if (/^\[?(fe80:|fc00:|fd[0-9a-f]{2}:)/i.test(host)) return false
    return true
}

// ── Tier helpers ──────────────────────────────────────────────────────────────

interface TierResult {
    image: CaptureResult['image']
    sourceUrl: string
}

const DEFAULT_HEADERS: Record<string, string> = {
    // Real-browser UA — many marketing sites refuse to serve content to
    // unknown bots and we don't want to skip them just to be polite.
    'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/*;q=0.8,*/*;q=0.5',
    'Accept-Language': 'en-US,en;q=0.9',
}

const FETCH_TIMEOUT_MS = 8_000
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB hard cap

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
        // Manually follow redirects so each hop can be re-checked against the
        // SSRF allowlist. With `redirect: 'follow'` a server that initially
        // serves a safe public host could 30x to 169.254.169.254 (cloud
        // metadata) or 127.0.0.1 and we would happily fetch it.
        let current = url
        for (let hop = 0; hop < 5; hop += 1) {
            if (!isSafeRemoteUrl(current)) {
                throw new Error('Redirect target is not a safe public address')
            }
            const res = await fetch(current, {
                ...init,
                signal: controller.signal,
                redirect: 'manual',
                headers: { ...DEFAULT_HEADERS, ...(init?.headers as Record<string, string> | undefined) },
            })
            if (res.status >= 300 && res.status < 400) {
                const location = res.headers.get('location')
                if (!location) return res
                const next = resolveUrl(location, current)
                if (!next) return res
                current = next
                continue
            }
            return res
        }
        throw new Error('Too many redirects')
    } finally {
        clearTimeout(t)
    }
}

async function fetchHtml(url: string): Promise<string | null> {
    try {
        const res = await fetchWithTimeout(url)
        if (!res.ok) return null
        const ct = res.headers.get('content-type') ?? ''
        if (!ct.includes('text/html') && !ct.includes('application/xhtml')) return null
        const body = await res.text()
        return body.slice(0, 500_000) // cap parse cost
    } catch {
        return null
    }
}

async function downloadImage(absoluteUrl: string): Promise<CaptureResult['image'] | null> {
    try {
        if (!isSafeRemoteUrl(absoluteUrl)) return null
        const res = await fetchWithTimeout(absoluteUrl)
        if (!res.ok) return null
        const contentType = res.headers.get('content-type') ?? ''
        if (!contentType.startsWith('image/')) return null

        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.byteLength === 0) return null
        if (buf.byteLength > MAX_IMAGE_BYTES) return null

        return { data: buf, contentType, bytes: buf.byteLength }
    } catch {
        return null
    }
}

function resolveUrl(href: string, base: string): string | null {
    try {
        return new URL(href, base).toString()
    } catch {
        return null
    }
}

async function tryOgImage(url: string): Promise<TierResult | null> {
    const html = await fetchHtml(url)
    if (!html) return null

    // Match either property= or name= variants, single or double quotes, in
    // any order. Twitter image is a strong runner-up when og:image is missing.
    const candidates: string[] = []
    const metaPatterns: RegExp[] = [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ]
    for (const pattern of metaPatterns) {
        const m = html.match(pattern)
        if (m?.[1]) candidates.push(m[1])
    }
    if (candidates.length === 0) return null

    for (const candidate of candidates) {
        const absolute = resolveUrl(candidate, url)
        if (!absolute) continue
        const image = await downloadImage(absolute)
        if (image) return { image, sourceUrl: absolute }
    }
    return null
}

async function tryAppleTouchIcon(url: string): Promise<TierResult | null> {
    const html = await fetchHtml(url)
    if (!html) return null

    // <link rel="apple-touch-icon" ...> tends to ship a 180×180 or larger PNG.
    // Pick the largest we can find by `sizes` attribute.
    const linkPattern = /<link[^>]+rel=["'](?:apple-touch-icon(?:-precomposed)?)["'][^>]*>/gi
    const matches = html.match(linkPattern) ?? []
    type Candidate = { href: string; size: number }
    const ranked: Candidate[] = []
    for (const tag of matches) {
        const href = /href=["']([^"']+)["']/i.exec(tag)?.[1]
        if (!href) continue
        const sizesAttr = /sizes=["']([^"']+)["']/i.exec(tag)?.[1] ?? ''
        const size = parseInt(sizesAttr.split('x')[0] ?? '0', 10) || 0
        ranked.push({ href, size })
    }
    ranked.sort((a, b) => b.size - a.size)
    for (const { href } of ranked) {
        const absolute = resolveUrl(href, url)
        if (!absolute) continue
        const image = await downloadImage(absolute)
        if (image) return { image, sourceUrl: absolute }
    }
    return null
}

async function tryFavicon(url: string): Promise<TierResult | null> {
    // Look for an explicit <link rel="icon"> first; fall back to /favicon.ico
    // on the apex host.
    const html = await fetchHtml(url)
    if (html) {
        const linkPattern = /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]*>/gi
        const matches = html.match(linkPattern) ?? []
        for (const tag of matches) {
            const href = /href=["']([^"']+)["']/i.exec(tag)?.[1]
            if (!href) continue
            const absolute = resolveUrl(href, url)
            if (!absolute) continue
            const image = await downloadImage(absolute)
            if (image) return { image, sourceUrl: absolute }
        }
    }

    try {
        const fallback = new URL('/favicon.ico', url).toString()
        const image = await downloadImage(fallback)
        if (image) return { image, sourceUrl: fallback }
    } catch {
        // ignore
    }
    return null
}

function decodeDataUrl(dataUrl: string): CaptureResult['image'] | null {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl)
    if (!match) return null
    const contentType = match[1]
    const buf = Buffer.from(match[2], 'base64')
    if (buf.byteLength === 0) return null
    if (buf.byteLength > MAX_IMAGE_BYTES) return null
    return { data: buf, contentType, bytes: buf.byteLength }
}
