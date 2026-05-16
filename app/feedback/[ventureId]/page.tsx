import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getVenturePublic } from '@/lib/queries'
import { FeedbackForm } from './FeedbackForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Share your feedback',
  robots: { index: false, follow: false },
}

function pickAccent(venture: { context?: unknown } | null): string {
  if (!venture?.context || typeof venture.context !== 'object') return '#C4975A'
  const ctx = venture.context as Record<string, unknown>
  const branding = ctx.branding as Record<string, unknown> | null | undefined
  if (!branding) return '#C4975A'
  const palette =
    (branding.palette as Record<string, unknown> | undefined) ??
    (branding.colorPalette as Record<string, unknown> | undefined) ??
    null
  const candidate =
    (palette?.primary as string | undefined) ??
    (palette?.accent as string | undefined) ??
    (branding.primaryColor as string | undefined) ??
    (branding.accent as string | undefined)
  if (typeof candidate === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(candidate)) {
    return candidate.startsWith('#') ? candidate : `#${candidate}`
  }
  return '#C4975A'
}

export default async function PublicFeedbackPage({
  params,
}: {
  params: Promise<{ ventureId: string }>
}) {
  const { ventureId } = await params
  const venture = await getVenturePublic(ventureId)
  if (!venture) notFound()

  const accent = pickAccent(venture)

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
        background: 'linear-gradient(180deg, #faf9f6 0%, #f4f2ed 100%)',
        fontFamily: '"DM Sans", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: '#ffffff',
          borderRadius: 24,
          border: '1px solid #e8e4dc',
          boxShadow: '0 30px 80px rgba(20, 18, 12, 0.08)',
          padding: '32px 28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span
            aria-hidden
            style={{
              width: 28,
              height: 28,
              background: accent,
              clipPath:
                'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              boxShadow: `0 0 18px ${accent}55`,
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: accent,
              }}
            >
              {venture.name}
            </div>
            <h1
              style={{
                margin: '4px 0 0',
                fontSize: 26,
                lineHeight: 1.15,
                fontWeight: 900,
                letterSpacing: -0.4,
                color: '#1c1a16',
              }}
            >
              Share your experience
            </h1>
          </div>
        </div>

        <p
          style={{
            margin: '0 0 22px',
            color: '#5f5a52',
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          Your words help us improve and inspire others. Leave a testimonial if you&apos;d like to be
          quoted publicly, or send private feedback we can act on.
        </p>

        <FeedbackForm ventureId={venture.id} accent={accent} />

        <p
          style={{
            margin: '20px 0 0',
            fontSize: 11,
            color: '#928c80',
            textAlign: 'center',
          }}
        >
          We&apos;ll only use your email to follow up about this submission.
        </p>
      </div>
    </div>
  )
}
