'use client'

import { useState } from 'react'
import type { SocialProvider } from '@/lib/marketing.shared'

// What the post will actually look like once it is live. Before this existed
// the draft editor showed a 72px thumbnail and nothing else, so captions were
// approved without ever seeing where the platform truncates them.

// Instagram collapses the caption behind "... more" at roughly 125 characters.
const IG_CAPTION_CUTOFF = 125
// LinkedIn collapses at roughly 3 lines / 210 characters on desktop.
const LI_CAPTION_CUTOFF = 210

function splitHashtags(body: string): { text: string; hashtags: string[] } {
  const lines = body.split('\n')
  const trailing: string[] = []

  // Pull hashtag-only lines off the end — the caption generator puts them
  // there, and both platforms render them as a distinct block.
  while (lines.length > 0) {
    const last = (lines[lines.length - 1] ?? '').trim()
    if (last === '') { lines.pop(); continue }
    if (/^#[\w-]+(\s+#[\w-]+)*$/.test(last)) {
      trailing.unshift(...last.split(/\s+/))
      lines.pop()
      continue
    }
    break
  }

  return { text: lines.join('\n').trim(), hashtags: trailing }
}

function Avatar({ label, size = 32 }: { label: string; size?: number }) {
  const initial = (label.trim()[0] ?? '?').toUpperCase()
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #8C5A7A, #B26F95)',
        color: '#fff',
        fontSize: size * 0.42,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  )
}

const frameStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 16,
  background: 'var(--bg)',
  overflow: 'hidden',
  maxWidth: 380,
  width: '100%',
}

function ImageArea({
  images,
  aspectRatio,
  alt,
}: {
  images: string[]
  aspectRatio: string
  alt: string
}) {
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState<Record<number, boolean>>({})

  const safeIndex = Math.min(index, Math.max(0, images.length - 1))
  const current = images[safeIndex]

  if (!current || failed[safeIndex]) {
    return (
      <div
        style={{
          aspectRatio,
          background: 'var(--sidebar)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--muted)',
          lineHeight: 1.6,
        }}
      >
        {images.length === 0
          ? 'No image yet — generate options or upload one, or an image will be generated automatically at publish time.'
          : 'This image could not be loaded.'}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current}
        alt={alt}
        style={{
          display: 'block',
          width: '100%',
          aspectRatio,
          objectFit: 'cover',
          background: 'var(--sidebar)',
        }}
        onError={() => setFailed((prev) => ({ ...prev, [safeIndex]: true }))}
      />

      {images.length > 1 && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: 'rgba(0,0,0,0.65)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 999,
            }}
          >
            {safeIndex + 1}/{images.length}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 0,
              right: 0,
              display: 'flex',
              gap: 5,
              justifyContent: 'center',
            }}
          >
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                onClick={() => setIndex(i)}
                style={{
                  width: 6,
                  height: 6,
                  padding: 0,
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  background: i === safeIndex ? '#fff' : 'rgba(255,255,255,0.45)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Caption({
  handle,
  text,
  hashtags,
  cutoff,
  inline,
}: {
  handle: string
  text: string
  hashtags: string[]
  cutoff: number
  /** Instagram prefixes the caption with the handle; LinkedIn does not. */
  inline: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const truncated = text.length > cutoff
  const shown = expanded || !truncated ? text : text.slice(0, cutoff).trimEnd()

  return (
    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
      {inline && <strong style={{ fontWeight: 700, marginRight: 6 }}>{handle}</strong>}
      {shown}
      {truncated && !expanded && (
        <>
          <span style={{ color: 'var(--muted)' }}>… </span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              color: 'var(--muted)',
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            more
          </button>
        </>
      )}
      {hashtags.length > 0 && (expanded || !truncated) && (
        <div style={{ marginTop: 8, color: '#2563eb', wordBreak: 'break-word' }}>
          {hashtags.join(' ')}
        </div>
      )}
    </div>
  )
}

export interface PostPreviewProps {
  provider: SocialProvider
  handle: string
  title: string
  body: string
  images: string[]
  aspect?: string
  firstComment?: string
}

function InstagramFeedPreview({ handle, body, images, aspect, firstComment }: PostPreviewProps) {
  const { text, hashtags } = splitHashtags(body)
  const aspectRatio = aspect === '4:5' ? '4 / 5' : aspect === '1.91:1' ? '1.91 / 1' : '1 / 1'

  return (
    <div style={frameStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <Avatar label={handle} />
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{handle}</div>
      </div>

      <ImageArea images={images} aspectRatio={aspectRatio} alt="Instagram post preview" />

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 16, color: 'var(--text-soft)' }} aria-hidden>
          <span>♡</span>
          <span>💬</span>
          <span>↗</span>
        </div>
        <Caption handle={handle} text={text} hashtags={hashtags} cutoff={IG_CAPTION_CUTOFF} inline />
        {firstComment?.trim() && (
          <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>
            <strong style={{ fontWeight: 700, marginRight: 6, color: 'var(--text)' }}>{handle}</strong>
            {firstComment.trim()}
          </div>
        )}
      </div>
    </div>
  )
}

function LinkedInFeedPreview({ handle, body, images, firstComment }: PostPreviewProps) {
  const { text, hashtags } = splitHashtags(body)

  return (
    <div style={frameStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <Avatar label={handle} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{handle}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Now · 🌐</div>
        </div>
      </div>

      <div style={{ padding: '0 14px 12px' }}>
        <Caption handle={handle} text={text} hashtags={hashtags} cutoff={LI_CAPTION_CUTOFF} inline={false} />
      </div>

      {images.length > 0 && (
        <ImageArea images={images} aspectRatio="1.91 / 1" alt="LinkedIn post preview" />
      )}

      <div
        style={{
          display: 'flex',
          gap: 18,
          padding: '10px 14px',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--muted)',
          borderTop: '1px solid var(--border)',
        }}
        aria-hidden
      >
        <span>👍 Like</span>
        <span>💬 Comment</span>
        <span>↗ Repost</span>
      </div>

      {firstComment?.trim() && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>
          <strong style={{ fontWeight: 700, marginRight: 6, color: 'var(--text)' }}>{handle}</strong>
          {firstComment.trim()}
        </div>
      )}
    </div>
  )
}

function YouTubePreview({ handle, title, body, images }: PostPreviewProps) {
  return (
    <div style={frameStyle}>
      <ImageArea images={images} aspectRatio="16 / 9" alt="YouTube thumbnail preview" />
      <div style={{ padding: '12px 14px', display: 'flex', gap: 10 }}>
        <Avatar label={handle} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35 }}>
            {title || 'Untitled video'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{handle}</div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-soft)',
              marginTop: 8,
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {body}
          </div>
        </div>
      </div>
    </div>
  )
}

export function PostPreview(props: PostPreviewProps) {
  if (props.provider === 'instagram') return <InstagramFeedPreview {...props} />
  if (props.provider === 'linkedin') return <LinkedInFeedPreview {...props} />
  return <YouTubePreview {...props} />
}
