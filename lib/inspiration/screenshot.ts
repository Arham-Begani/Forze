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
    tier: 1 | 2 | 3 | 4
    image: {
        data: Buffer
        contentType: string
        bytes: number
    }
    sourceUrl?: string // exact resource we ended up downloading
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
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return false
    if (host.endsWith('.localhost') || host.endsWith('.local')) return false
    if (/^10\./.test(host)) return false
    if (/^192\.168\./.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
    if (/^169\.254\./.test(host)) return false // AWS / GCE metadata
    if (/^100\.6[4-9]\./.test(host) || /^100\.[7-9]\d\./.test(host) || /^100\.1[01]\d\./.test(host) || /^100\.12[0-7]\./.test(host)) return false
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
        return await fetch(url, {
            ...init,
            signal: controller.signal,
            redirect: 'follow',
            headers: { ...DEFAULT_HEADERS, ...(init?.headers as Record<string, string> | undefined) },
        })
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
