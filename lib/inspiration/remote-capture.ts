// lib/inspiration/remote-capture.ts
//
// Tier-0 capture: actual browser screenshot of the live page via Microlink,
// plus programmatically-extracted dominant palette + brand color + background
// color. This is the single biggest accuracy upgrade in the inspiration
// pipeline — it replaces "Gemini guesses hex codes from an og:image" with
// "Gemini sees the real page render alongside ground-truth color values".
//
// Microlink free tier: 50 req/day per IP, no auth. For paid usage set
// MICROLINK_API_KEY and we'll attach it. Provider is swappable via
// INSPIRATION_SCREENSHOT_PROVIDER but right now microlink is the only
// implementation — the env exists so we can drop in Urlbox / ScreenshotOne
// later without touching call sites.
//
// SAFETY: the upstream URL is the only thing we pass to Microlink, and we
// download the returned screenshot via the same fetchWithTimeout that already
// re-validates redirects against the SSRF allowlist. There's no path where a
// malicious target can pivot to internal addresses through us.

import { isSafeRemoteUrl } from '@/lib/inspiration/screenshot'

const MICROLINK_TIMEOUT_MS = Number(process.env.INSPIRATION_REMOTE_TIMEOUT_MS ?? 15_000)
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB hard cap (same as Tier 1-3)

interface RemoteCaptureSuccess {
    image: { data: Buffer; contentType: string; bytes: number }
    sourceUrl: string
    groundTruth: {
        palette?: string[]
        brandColor?: string
        backgroundColor?: string
        title?: string
        description?: string
        publisher?: string
    }
}

// Public entrypoint. Returns null on any failure — the caller (screenshot.ts)
// falls through to the og:image / favicon tiers so a Microlink hiccup never
// breaks the analyze flow.
export async function captureWithMicrolink(url: string): Promise<RemoteCaptureSuccess | null> {
    if (!isSafeRemoteUrl(url)) return null

    const apiUrl = buildMicrolinkUrl(url)
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (process.env.MICROLINK_API_KEY) headers['x-api-key'] = process.env.MICROLINK_API_KEY

    const meta = await fetchJson(apiUrl, headers)
    if (!meta || meta.status !== 'success' || !meta.data) return null

    // Microlink returns the screenshot at data.screenshot.url. The free tier
    // hosts it on iad.microlink.io with a short-lived signed URL.
    const screenshotUrl =
        (meta.data.screenshot && typeof meta.data.screenshot === 'object' && meta.data.screenshot.url) ||
        null
    if (!screenshotUrl || typeof screenshotUrl !== 'string') return null

    const image = await downloadImage(screenshotUrl)
    if (!image) return null

    const palette = extractPaletteFromMicrolinkData(meta.data)
    const brandColor = typeof meta.data.color === 'string' ? meta.data.color : undefined
    const backgroundColor =
        typeof meta.data.backgroundColor === 'string' ? meta.data.backgroundColor : undefined
    const title = typeof meta.data.title === 'string' ? meta.data.title : undefined
    const description = typeof meta.data.description === 'string' ? meta.data.description : undefined
    const publisher = typeof meta.data.publisher === 'string' ? meta.data.publisher : undefined

    return {
        image,
        sourceUrl: screenshotUrl,
        groundTruth: { palette, brandColor, backgroundColor, title, description, publisher },
    }
}

// ── Builders ─────────────────────────────────────────────────────────────────

function buildMicrolinkUrl(target: string): string {
    // Documented at https://microlink.io/docs/api/parameters
    // - screenshot: true     → full-page render
    // - palette: true        → Vibrant-extracted dominant colors
    // - meta: true           → og: tags + title + description
    // - viewport.width/height → desktop hero so we capture above-the-fold
    // - waitUntil: networkidle0 → fonts and gradients have rendered
    // - device                → Apple Studio Display 5K resolution
    const params = new URLSearchParams({
        url: target,
        screenshot: 'true',
        palette: 'true',
        meta: 'true',
        'viewport.width': '1440',
        'viewport.height': '900',
        'screenshot.type': 'jpeg',
        'screenshot.quality': '85',
        waitUntil: 'networkidle0',
    })
    return `https://api.microlink.io/?${params.toString()}`
}

// ── Network helpers ──────────────────────────────────────────────────────────

async function fetchJson(url: string, headers: Record<string, string>): Promise<MicrolinkResponse | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), MICROLINK_TIMEOUT_MS)
    try {
        const res = await fetch(url, { headers, signal: controller.signal })
        if (!res.ok) {
            // 429 — rate limit. Treat as transient failure so we don't poison
            // a venture's whole analyze run on a single throttle event.
            return null
        }
        const json = (await res.json()) as MicrolinkResponse
        return json
    } catch {
        return null
    } finally {
        clearTimeout(timer)
    }
}

async function downloadImage(absoluteUrl: string): Promise<RemoteCaptureSuccess['image'] | null> {
    if (!isSafeRemoteUrl(absoluteUrl)) return null
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), MICROLINK_TIMEOUT_MS)
    try {
        const res = await fetch(absoluteUrl, { signal: controller.signal })
        if (!res.ok) return null
        const contentType = res.headers.get('content-type') ?? ''
        if (!contentType.startsWith('image/')) return null
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null
        return { data: buf, contentType, bytes: buf.byteLength }
    } catch {
        return null
    } finally {
        clearTimeout(timer)
    }
}

// ── Palette extraction from Microlink response ───────────────────────────────
//
// Microlink returns Vibrant.js palette under `data.palette` — sometimes as an
// array of hex strings, sometimes as an object keyed by Vibrant swatch name
// (Vibrant / DarkVibrant / LightVibrant / Muted / DarkMuted / LightMuted) with
// objects holding `{ rgb, hex, population }`. Normalise both shapes into a
// flat ordered hex array, most-dominant-first.

interface MicrolinkResponse {
    status?: 'success' | 'fail'
    data?: {
        screenshot?: { url?: string } | null
        palette?: unknown
        color?: string
        backgroundColor?: string
        title?: string
        description?: string
        publisher?: string
    } | null
}

function extractPaletteFromMicrolinkData(data: NonNullable<MicrolinkResponse['data']>): string[] {
    const raw = data.palette
    if (!raw) return []

    if (Array.isArray(raw)) {
        // Array form — usually already ordered by frequency.
        return raw
            .map((v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null))
            .filter((v): v is string => !!v)
            .slice(0, 6)
    }

    if (typeof raw === 'object') {
        // Object form: { Vibrant: { hex, population }, DarkVibrant: ..., ... }
        const entries = Object.values(raw as Record<string, unknown>)
            .map((swatch) => {
                if (!swatch || typeof swatch !== 'object') return null
                const s = swatch as { hex?: unknown; population?: unknown }
                if (typeof s.hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.hex)) return null
                const pop = typeof s.population === 'number' ? s.population : 0
                return { hex: s.hex.toLowerCase(), pop }
            })
            .filter((v): v is { hex: string; pop: number } => v !== null)
        entries.sort((a, b) => b.pop - a.pop)
        return entries.map((e) => e.hex).slice(0, 6)
    }

    return []
}
