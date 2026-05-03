import 'server-only'

import type { CreateMarketingAssetSeed } from '@/lib/marketing.shared'

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function truncate(value: string, length: number): string {
  if (value.length <= length) return value
  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}…`
}

function normalizeHashtags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag.replace(/^#+/, '')}`))
  }

  if (typeof value === 'string') {
    return value
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.startsWith('#'))
  }

  return []
}

function extractSocialPostText(entry: unknown): string {
  const record = asObject(entry)
  if (!record) {
    return typeof entry === 'string' ? cleanText(entry) : ''
  }

  return cleanText(
    firstString(
      record.content,
      record.caption,
      record.text,
      record.copy,
      record.post,
      record.body,
      record.description
    )
  )
}

function extractSocialLink(entry: unknown): string | null {
  const record = asObject(entry)
  if (!record) return null
  const link = firstString(record.linkUrl, record.url, record.link, record.ctaUrl)
  return link || null
}

function extractMarketingOverview(marketing: Record<string, unknown> | null | undefined): string {
  if (!marketing) return ''
  const gtm = asObject(marketing.gtmStrategy)
  return cleanText(
    firstString(
      gtm?.overview,
      marketing.theme,
      marketing.marketingPlan,
      marketing.summary
    )
  )
}

function extractMarketingPlan(marketing: Record<string, unknown> | null | undefined): string {
  if (!marketing) return ''
  const gtm = asObject(marketing.gtmStrategy)
  return cleanText(firstString(marketing.marketingPlan, gtm?.marketingPlan))
}

function extractKeywords(marketing: Record<string, unknown> | null | undefined, ventureName: string): string[] {
  const gtm = asObject(marketing?.gtmStrategy)
  const channels = asArray(gtm?.channels ?? marketing?.channels)
    .map((channel) => firstString(channel, asObject(channel)?.name, asObject(channel)?.title))
    .filter(Boolean)
  const base = [
    ventureName,
    ...ventureName.split(/\s+/),
    ...channels,
  ]

  return [...new Set(base.map((item) => item.trim()).filter(Boolean))].slice(0, 8)
}

export function buildLinkedInDraftSeeds(
  ventureName: string,
  marketing: Record<string, unknown> | null | undefined,
  limit = 5
): CreateMarketingAssetSeed[] {
  const socialCalendar = asArray(marketing?.socialCalendar)
  const seeds = socialCalendar
    .map((entry, index) => {
      const text = extractSocialPostText(entry)
      if (!text) return null

      const hashtags = normalizeHashtags(asObject(entry)?.hashtags)
      const composedBody = cleanText([text, hashtags.join(' ')].filter(Boolean).join('\n\n'))
      const title = truncate(firstString(asObject(entry)?.title, composedBody, `${ventureName} LinkedIn post ${index + 1}`), 90)

      return {
        provider: 'linkedin' as const,
        assetType: 'linkedin_post' as const,
        title,
        body: composedBody,
        payload: {
          linkUrl: extractSocialLink(entry),
          visibility: 'PUBLIC',
        },
      }
    })
    .filter(Boolean)
    .slice(0, limit)

  if (seeds.length > 0) return seeds as CreateMarketingAssetSeed[]

  const overview = extractMarketingOverview(marketing)
  if (!overview) return []

  return [{
    provider: 'linkedin',
    assetType: 'linkedin_post',
    title: truncate(`${ventureName} launch update`, 90),
    body: overview,
    payload: {
      linkUrl: null,
      visibility: 'PUBLIC',
    },
  }]
}

// Keep raw paragraph breaks if the caption already uses them — Instagram readers
// scan, they don't read walls of text.
function preserveParagraphs(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((para) => para.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

function extractInstagramHook(entry: unknown): string {
  const record = asObject(entry)
  return cleanText(firstString(record?.hook, record?.headline, record?.title))
}

function extractInstagramCta(entry: unknown): string {
  const record = asObject(entry)
  return cleanText(firstString(record?.cta, record?.callToAction, record?.ctaText))
}

function composeInstagramCaption(
  hook: string,
  rawText: string,
  cta: string,
  hashtags: string[],
  ventureName: string
): string {
  const paragraphs = preserveParagraphs(rawText) || cleanText(rawText)

  // Avoid duplicating the hook if it's already the opening sentence.
  const opening = (() => {
    if (!hook) return ''
    const head = paragraphs.split(/\n|\.\s/)[0] ?? ''
    if (head && head.toLowerCase().includes(hook.toLowerCase().slice(0, Math.min(24, hook.length)))) {
      return ''
    }
    return hook.endsWith('.') || hook.endsWith('?') || hook.endsWith('!') ? hook : `${hook}.`
  })()

  const closing = cta
    ? cta
    : `Follow @${ventureName.replace(/[^a-zA-Z0-9_]+/g, '').toLowerCase()} for more.`

  const sections = [opening, paragraphs, closing, hashtags.join(' ')]
    .map((section) => section.trim())
    .filter(Boolean)

  return sections.join('\n\n')
}

export function buildInstagramDraftSeeds(
  ventureName: string,
  marketing: Record<string, unknown> | null | undefined,
  limit = 10
): CreateMarketingAssetSeed[] {
  const socialCalendar = asArray(marketing?.socialCalendar)
  const hashtagStrategy = asObject(marketing?.hashtagStrategy)
  const igGlobalHashtags = normalizeHashtags(hashtagStrategy?.instagram)

  const buildSeed = (entry: unknown, index: number): CreateMarketingAssetSeed | null => {
    const text = extractSocialPostText(entry)
    if (!text) return null

    const entryHashtags = normalizeHashtags(asObject(entry)?.hashtags)
    const allHashtags = [...new Set([...entryHashtags, ...igGlobalHashtags])].slice(0, 30)

    const hook = extractInstagramHook(entry)
    const cta = extractInstagramCta(entry)
    const composedBody = composeInstagramCaption(hook, text, cta, allHashtags, ventureName)

    const title = truncate(
      firstString(hook, asObject(entry)?.title, composedBody, `${ventureName} Instagram post ${index + 1}`),
      90
    )

    return {
      provider: 'instagram' as const,
      assetType: 'instagram_post' as const,
      title,
      body: composedBody,
      payload: {
        hashtags: allHashtags,
        ventureName,
      },
    }
  }

  const igEntries = socialCalendar.filter((entry) => asObject(entry)?.platform === 'instagram')
  let seeds = igEntries.map(buildSeed).filter(Boolean).slice(0, limit) as CreateMarketingAssetSeed[]

  if (seeds.length === 0 && socialCalendar.length > 0) {
    seeds = socialCalendar.map(buildSeed).filter(Boolean).slice(0, limit) as CreateMarketingAssetSeed[]
  }

  if (seeds.length > 0) return seeds

  const overview = extractMarketingOverview(marketing)
  if (!overview) return []

  const fallbackHashtags = igGlobalHashtags.slice(0, 30)
  const composedBody = composeInstagramCaption(
    `Meet ${ventureName}.`,
    overview,
    `Curious? Tap the link in bio to learn more.`,
    fallbackHashtags,
    ventureName
  )

  return [{
    provider: 'instagram',
    assetType: 'instagram_post',
    title: truncate(`Meet ${ventureName}`, 90),
    body: composedBody,
    payload: {
      hashtags: fallbackHashtags,
      ventureName,
    },
  }]
}

export function buildYouTubeDraftSeed(
  ventureName: string,
  marketing: Record<string, unknown> | null | undefined
): CreateMarketingAssetSeed | null {
  const overview = extractMarketingOverview(marketing)
  const marketingPlan = extractMarketingPlan(marketing)
  const description = cleanText(
    [
      overview,
      marketingPlan,
      `Learn more about ${ventureName} and follow the launch journey.`,
    ].filter(Boolean).join('\n\n')
  )

  if (!description) return null

  return {
    provider: 'youtube',
    assetType: 'youtube_video',
    title: truncate(`${ventureName}: launch story and what comes next`, 100),
    body: description,
    payload: {
      videoSourceUrl: '',
      privacyStatus: 'unlisted',
      tags: extractKeywords(marketing, ventureName),
      categoryId: '28',
    },
  }
}
