import 'server-only'

import { decryptSecret } from '@/lib/marketing-crypto'
import { extractJSON, getFlashModel } from '@/lib/gemini'
import type { SocialConnectionSecretRecord } from '@/lib/marketing.shared'
import { z } from 'zod'

interface InstagramComment {
  id: string
  text: string
  username: string | null
  timestamp: string | null
}

export interface InstagramPostInsights {
  likeCount: number | null
  commentsCount: number | null
  reach: number | null
  impressions: number | null
  saved: number | null
  permalink: string | null
  caption: string | null
  comments: InstagramComment[]
  // Reason the comments array is shorter than commentsCount. Most common:
  // missing instagram_business_manage_comments scope on the connected account.
  commentsFetchError: string | null
  fetchedAt: string
}

const commentAnalysisSchema = z.object({
  totalCommentsAnalyzed: z.number().min(0),
  themes: z.array(z.object({
    theme: z.string().min(2).max(80),
    frequency: z.enum(['rare', 'occasional', 'common']),
    exampleQuote: z.string().min(1).max(280),
  })).max(8),
  topPositiveSignal: z.string().min(1).max(280).nullable(),
  topConcern: z.string().min(1).max(280).nullable(),
  notableQuestions: z.array(z.string().min(1).max(240)).max(6),
  commentDriverVerdict: z.string().min(10).max(360),
})

const validationSchema = z.object({
  signalStrength: z.enum(['weak', 'moderate', 'strong']),
  signalSummary: z.string().min(10).max(400),
  sentiment: z.object({
    positive: z.number().min(0).max(100),
    neutral: z.number().min(0).max(100),
    negative: z.number().min(0).max(100),
    headline: z.string().min(5).max(200),
  }),
  commentAnalysis: commentAnalysisSchema,
  audienceObservations: z.array(z.string().min(5).max(240)).min(1).max(6),
  ideaValidationVerdict: z.enum(['validated', 'mixed', 'invalidated', 'inconclusive']),
  verdictReasoning: z.string().min(20).max(600),
  startupImprovements: z.array(z.object({
    area: z.string().min(2).max(80),
    suggestion: z.string().min(10).max(360),
    priority: z.enum(['high', 'medium', 'low']),
  })).min(1).max(8),
})

const aggregateValidationSchema = validationSchema.extend({
  postsAnalyzed: z.number().min(0),
  totalEngagement: z.object({
    likes: z.number().min(0),
    comments: z.number().min(0),
    reach: z.number().min(0),
    impressions: z.number().min(0),
    saves: z.number().min(0),
  }),
  perPostHighlights: z.array(z.object({
    assetId: z.string().min(1),
    headline: z.string().min(1).max(200),
    signal: z.enum(['weak', 'moderate', 'strong']),
  })).max(20),
})

export type InstagramValidationReport = z.infer<typeof validationSchema>
export type InstagramAggregateValidationReport = z.infer<typeof aggregateValidationSchema>

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export class InstagramPostMissingError extends Error {
  constructor(message = 'Instagram post no longer exists') {
    super(message)
    this.name = 'InstagramPostMissingError'
  }
}

interface IgErrorShape {
  error?: {
    message?: string
    code?: number
    error_subcode?: number
    type?: string
  }
}

function isMissingObjectError(parsed: unknown): boolean {
  const err = (parsed as IgErrorShape)?.error
  if (!err) return false
  // Error code 100 + subcode 33 is Meta's canonical "Object with ID X does not exist".
  if (err.code === 100 && err.error_subcode === 33) return true
  const message = (err.message ?? '').toLowerCase()
  return (
    message.includes('does not exist') ||
    message.includes('object with id') ||
    message.includes('unsupported get request')
  )
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  const text = await response.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Unexpected Instagram response: ${text.slice(0, 200)}`)
  }
  if (!response.ok) {
    if (response.status === 404 || isMissingObjectError(parsed)) {
      throw new InstagramPostMissingError(
        (parsed as IgErrorShape)?.error?.message ?? 'Instagram post no longer exists'
      )
    }
    const errMessage = (parsed as { error?: { message?: string } })?.error?.message ?? text
    throw new Error(`Instagram Graph error: ${errMessage}`)
  }
  return parsed as T
}

function pickInsightValue(
  insights: { name?: string; values?: Array<{ value?: number }> }[] | undefined,
  metric: string
): number | null {
  if (!insights) return null
  const entry = insights.find((item) => item.name === metric)
  if (!entry) return null
  return asNumber(entry.values?.[0]?.value)
}

export async function fetchInstagramPostInsights(
  mediaId: string,
  connection: SocialConnectionSecretRecord
): Promise<InstagramPostInsights> {
  const accessToken = decryptSecret(connection.access_token_encrypted)
  if (!accessToken) {
    throw new Error('Instagram connection is missing an access token — reconnect Instagram')
  }

  const tokenParam = `access_token=${encodeURIComponent(accessToken)}`

  // Core media fields — these are reliably available on all media types.
  const media = await fetchJson<{
    id?: string
    permalink?: string
    caption?: string
    like_count?: number
    comments_count?: number
    media_product_type?: string
    media_type?: string
  }>(`https://graph.instagram.com/v21.0/${encodeURIComponent(mediaId)}?fields=id,permalink,caption,like_count,comments_count,media_product_type,media_type&${tokenParam}`)

  // Insights are gated by media type — feed images expose reach/impressions/saved.
  let reach: number | null = null
  let impressions: number | null = null
  let saved: number | null = null
  try {
    const insights = await fetchJson<{
      data?: { name?: string; values?: Array<{ value?: number }> }[]
    }>(`https://graph.instagram.com/v21.0/${encodeURIComponent(mediaId)}/insights?metric=reach,impressions,saved&${tokenParam}`)
    reach = pickInsightValue(insights.data, 'reach')
    impressions = pickInsightValue(insights.data, 'impressions')
    saved = pickInsightValue(insights.data, 'saved')
  } catch {
    // Older media or unsupported types — leave insight values null instead of failing the whole request.
  }

  // Diagnostic: pull connected account type + actual scopes the token has.
  // These two facts decide whether the comment endpoint will ever return data.
  let diagAccountType: string | null = null
  let diagAccountUsername: string | null = null
  try {
    const me = await fetchJson<{ account_type?: string; username?: string }>(
      `https://graph.instagram.com/v21.0/me?fields=account_type,username&${tokenParam}`
    )
    diagAccountType = asString(me.account_type)
    diagAccountUsername = asString(me.username)
  } catch {
    // Non-fatal — we'll still attempt the comments fetch below.
  }
  const storedScopes = Array.isArray(connection.scopes) ? connection.scopes.filter((s): s is string => typeof s === 'string') : []
  const hasManageComments = storedScopes.includes('instagram_business_manage_comments')

  // Comments — limit to the most recent 25 so we don't overwhelm Gemini.
  let comments: InstagramComment[] = []
  let commentsFetchError: string | null = null
  const commentsUrl = `https://graph.instagram.com/v21.0/${encodeURIComponent(mediaId)}/comments?fields=id,text,username,timestamp&limit=25&${tokenParam}`
  try {
    const commentResponse = await fetchJson<{
      data?: { id?: string; text?: string; username?: string; timestamp?: string }[]
    }>(commentsUrl)
    comments = (commentResponse.data ?? []).map((entry) => ({
      id: asString(entry.id) ?? '',
      text: asString(entry.text) ?? '',
      username: asString(entry.username),
      timestamp: asString(entry.timestamp),
    })).filter((c) => c.id && c.text)

    // The endpoint can return HTTP 200 with an empty data array even when
    // the post has comments. Build a precise diagnostic that tells the user
    // exactly which of the gating conditions failed.
    if (comments.length === 0 && typeof asNumber(media.comments_count) === 'number' && (asNumber(media.comments_count) ?? 0) > 0) {
      const reasons: string[] = []
      if (!hasManageComments) {
        reasons.push(`the stored access token is missing the instagram_business_manage_comments scope (granted scopes: ${storedScopes.join(', ') || 'none'})`)
      }
      if (diagAccountType && diagAccountType.toUpperCase() === 'PERSONAL') {
        reasons.push(`the connected Instagram account "${diagAccountUsername ?? 'unknown'}" is a PERSONAL account — only BUSINESS or CREATOR accounts expose comments via the Graph API`)
      }
      if (reasons.length === 0) {
        // Both checks passed but the API still returned empty — that means
        // the app itself doesn't have the permission approved by Meta App
        // Review, or the connected user isn't a registered tester.
        reasons.push(
          `scope appears granted (${storedScopes.join(', ')}) and account type is ${diagAccountType ?? 'unknown'}, but Meta still returned 0 comments. ` +
          `This usually means the Meta App is in Development Mode and the connected Instagram user is not added as a tester/role on the app, ` +
          `or the instagram_business_manage_comments permission has not been submitted for App Review yet.`
        )
      }
      commentsFetchError =
        `Instagram says this post has ${media.comments_count} comment${media.comments_count === 1 ? '' : 's'} but the comments endpoint returned 0. Reason: ${reasons.join(' AND ')}.`
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    const ctx = `account_type=${diagAccountType ?? 'unknown'}, scopes=[${storedScopes.join(', ') || 'none'}]`
    if (/permission|scope|access|oauth/i.test(message)) {
      commentsFetchError =
        `Instagram comments could not be read (${message}). Context: ${ctx}. Disconnect & reconnect Instagram, confirm the account is Business/Creator, and verify the connected user is a tester on the Meta App if it's still in Development Mode.`
    } else {
      commentsFetchError = `Instagram comment fetch failed: ${message}. Context: ${ctx}`
    }
    comments = []
  }

  return {
    likeCount: asNumber(media.like_count),
    commentsCount: asNumber(media.comments_count),
    reach,
    impressions,
    saved,
    permalink: asString(media.permalink),
    caption: asString(media.caption),
    comments,
    commentsFetchError,
    fetchedAt: new Date().toISOString(),
  }
}

export async function generateValidationReport(input: {
  ventureName: string
  caption: string
  insights: InstagramPostInsights
}): Promise<InstagramValidationReport> {
  const { ventureName, caption, insights } = input

  const metricsBlock = [
    `Likes: ${insights.likeCount ?? 'n/a'}`,
    `Comments: ${insights.commentsCount ?? 'n/a'}`,
    `Reach: ${insights.reach ?? 'n/a'}`,
    `Impressions: ${insights.impressions ?? 'n/a'}`,
    `Saves: ${insights.saved ?? 'n/a'}`,
  ].join('\n')

  const commentsUnreachable =
    insights.comments.length === 0 &&
    typeof insights.commentsCount === 'number' &&
    insights.commentsCount > 0

  const commentsBlock = insights.comments.length > 0
    ? insights.comments
        .slice(0, 25)
        .map((c, i) => `${i + 1}. @${c.username ?? 'unknown'}: ${c.text}`)
        .join('\n')
    : commentsUnreachable
      ? `(Instagram reports ${insights.commentsCount} comment${insights.commentsCount === 1 ? '' : 's'} on this post but Forze could not read them — likely missing instagram_business_manage_comments permission. ${insights.commentsFetchError ?? ''})`
      : '(no comments yet)'

  const systemPrompt = [
    'You are a senior product strategist running market validation off real Instagram engagement data for an early-stage venture.',
    'You are blunt and specific. You do NOT cheerlead. You score idea-market fit based on the actual signal in the data, not vibes.',
    'CRITICAL: like counts at this stage are an extremely weak signal — most posts launch to a tiny audience. Do NOT use low likes alone to dismiss validation. Substantive comments (questions, intent-to-buy, criticism, requests, tag-a-friend) carry far more signal than 100 silent likes. Read the comments carefully and reason about what they reveal about audience need, objections, and language.',
    'Only call the verdict "inconclusive" if there are essentially zero comments AND zero engagement of any kind. If even 2-3 comments exist, extract real signal from their content.',
    'You always return valid JSON conforming to the schema given in the user prompt.',
  ].join('\n')

  const userPrompt = [
    `Venture: ${ventureName}`,
    `Caption that was published:`,
    caption.slice(0, 1500),
    '',
    'Engagement metrics:',
    metricsBlock,
    '',
    `Recent comments (${insights.comments.length} returned):`,
    commentsBlock,
    '',
    'Analyze this as a market validation signal. Read every comment. Identify recurring themes, the most positive intent-signal, the strongest concern/objection, and any direct questions that hint at unmet need or buying interest.',
    'Weight your verdict heavily on comment substance, not on like count. Low likes with substantive comments = moderate-to-strong signal. High likes with hollow comments (emoji-only, "nice", spam) = weak signal.',
    '',
    'IMPORTANT — comment-count integrity rule:',
    '- The metric Comments above is the AUTHORITATIVE total comment count for this post (from Instagram).',
    '- Set commentAnalysis.totalCommentsAnalyzed equal to that Comments metric (NOT to the number of comments shown to you), so the UI never shows "0 comments" when the post actually has comments.',
    '- If the comments block says Forze could not read the comments due to a missing permission, do NOT call this "no comments". State plainly in commentDriverVerdict that the comments exist but the Instagram permission to read them is missing, and recommend reconnecting Instagram. Set themes/topPositiveSignal/topConcern/notableQuestions to safe empty values in that case.',
    '',
    'Return ONLY valid JSON with this exact shape:',
    `{
  "signalStrength": "weak" | "moderate" | "strong",
  "signalSummary": "1-3 sentence summary of what the engagement actually tells us.",
  "sentiment": {
    "positive": 0-100,
    "neutral": 0-100,
    "negative": 0-100,
    "headline": "short sentiment headline"
  },
  "commentAnalysis": {
    "totalCommentsAnalyzed": number,
    "themes": [
      { "theme": "short label", "frequency": "rare|occasional|common", "exampleQuote": "verbatim snippet from a comment" }
    ],
    "topPositiveSignal": "strongest pro-signal sentence quoted/paraphrased from comments, or null if none",
    "topConcern": "strongest objection/criticism quoted/paraphrased from comments, or null if none",
    "notableQuestions": ["direct questions audience asked that reveal intent or confusion"],
    "commentDriverVerdict": "what the comments alone (ignoring like count) say about idea-market fit"
  },
  "audienceObservations": ["concrete observation 1", "concrete observation 2"],
  "ideaValidationVerdict": "validated" | "mixed" | "invalidated" | "inconclusive",
  "verdictReasoning": "why the verdict, grounded in the comments first and metrics second",
  "startupImprovements": [
    { "area": "positioning|product|pricing|audience|channel|messaging", "suggestion": "concrete actionable change", "priority": "high|medium|low" }
  ]
}`,
    '',
    'Sentiment numbers must add to ~100. Improvements must be specific to this venture, derived from what the comments revealed — not generic startup advice. If there are 0 comments, set commentAnalysis.themes to [], topPositiveSignal/topConcern to null, notableQuestions to [], and say so honestly in commentDriverVerdict.',
  ].join('\n')

  const model = getFlashModel(8192)
  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
    ],
  })

  const text = result.response.text()
  const parsed = validationSchema.safeParse(extractJSON(text))
  if (!parsed.success) {
    throw new Error('Validation analyzer returned invalid JSON')
  }
  return parsed.data
}

export interface AggregatePostInput {
  assetId: string
  title: string | null
  caption: string
  insights: InstagramPostInsights
}

export async function generateAggregateValidationReport(input: {
  ventureName: string
  posts: AggregatePostInput[]
}): Promise<InstagramAggregateValidationReport> {
  const { ventureName, posts } = input

  const totals = posts.reduce(
    (acc, post) => {
      acc.likes += post.insights.likeCount ?? 0
      acc.comments += post.insights.commentsCount ?? 0
      acc.reach += post.insights.reach ?? 0
      acc.impressions += post.insights.impressions ?? 0
      acc.saves += post.insights.saved ?? 0
      return acc
    },
    { likes: 0, comments: 0, reach: 0, impressions: 0, saves: 0 }
  )

  let anyCommentsUnreachable = false
  const postBlocks = posts.map((post, index) => {
    const m = post.insights
    const metrics = `Likes ${m.likeCount ?? 'n/a'} · Comments ${m.commentsCount ?? 'n/a'} · Reach ${m.reach ?? 'n/a'} · Impressions ${m.impressions ?? 'n/a'} · Saves ${m.saved ?? 'n/a'}`
    const unreachable =
      m.comments.length === 0 &&
      typeof m.commentsCount === 'number' &&
      m.commentsCount > 0
    if (unreachable) anyCommentsUnreachable = true
    const comments = m.comments.length > 0
      ? m.comments.slice(0, 25).map((c, i) => `    ${i + 1}. @${c.username ?? 'unknown'}: ${c.text}`).join('\n')
      : unreachable
        ? `    (Instagram reports ${m.commentsCount} comment${m.commentsCount === 1 ? '' : 's'} on this post but Forze could not read them — likely missing instagram_business_manage_comments permission. ${m.commentsFetchError ?? ''})`
        : '    (no comments)'
    return [
      `--- POST ${index + 1} (assetId: ${post.assetId}) ---`,
      `Title: ${post.title ?? '(untitled)'}`,
      `Caption: ${post.caption.slice(0, 800)}`,
      `Metrics: ${metrics}`,
      `Comments:`,
      comments,
    ].join('\n')
  }).join('\n\n')

  const totalsBlock = [
    `Posts analyzed: ${posts.length}`,
    `Total likes: ${totals.likes}`,
    `Total comments: ${totals.comments}`,
    `Total reach: ${totals.reach}`,
    `Total impressions: ${totals.impressions}`,
    `Total saves: ${totals.saves}`,
  ].join('\n')

  const systemPrompt = [
    'You are a senior product strategist running market validation across an entire body of Instagram content for an early-stage venture.',
    'You synthesize signal across ALL posts together — not one post at a time. Look for patterns: which messaging resonated, which fell flat, what the audience consistently asks for, what objections recur.',
    'You are blunt and specific. You do NOT cheerlead. Like counts at this stage are weak signal — comment substance is the primary signal. Even 5-10 substantive comments across the body of work can produce a real verdict; do not call "inconclusive" unless engagement is essentially zero across every post.',
    'You always return valid JSON conforming to the schema given in the user prompt.',
  ].join('\n')

  const userPrompt = [
    `Venture: ${ventureName}`,
    '',
    'Aggregate engagement totals:',
    totalsBlock,
    '',
    'All posts and their comments:',
    postBlocks,
    '',
    'Synthesize a single venture-level validation report by reading across every post. Compare posts to each other — which captions/angles produced real comment engagement, which produced silence?',
    'Read every comment. Identify cross-post recurring themes, the strongest positive signal, the strongest concern, and any direct questions that reveal intent or confusion.',
    'Weight your verdict heavily on comment substance, not on like volume. Be honest if the body of work is too thin.',
    '',
    'IMPORTANT — comment-count integrity rule:',
    '- The aggregate "Total comments" above is the AUTHORITATIVE count across all posts (sum of Instagram\'s commentsCount).',
    '- Set commentAnalysis.totalCommentsAnalyzed equal to that Total comments number (NOT to the number of comments shown to you), so the UI never shows "0 comments" when the venture actually has comments.',
    anyCommentsUnreachable
      ? '- AT LEAST ONE post above has comments Forze could not read (missing Instagram permission). Do NOT call this "no comments". State plainly in commentDriverVerdict that the comments exist but the Instagram permission to read them is missing, and recommend reconnecting Instagram. Set themes/topPositiveSignal/topConcern/notableQuestions to safe empty values for those posts.'
      : '',
    '',
    'Return ONLY valid JSON with this exact shape:',
    `{
  "postsAnalyzed": ${posts.length},
  "totalEngagement": {
    "likes": ${totals.likes},
    "comments": ${totals.comments},
    "reach": ${totals.reach},
    "impressions": ${totals.impressions},
    "saves": ${totals.saves}
  },
  "signalStrength": "weak" | "moderate" | "strong",
  "signalSummary": "1-3 sentence venture-level summary across all posts.",
  "sentiment": {
    "positive": 0-100,
    "neutral": 0-100,
    "negative": 0-100,
    "headline": "short sentiment headline"
  },
  "commentAnalysis": {
    "totalCommentsAnalyzed": number,
    "themes": [
      { "theme": "short label", "frequency": "rare|occasional|common", "exampleQuote": "verbatim snippet" }
    ],
    "topPositiveSignal": "strongest pro-signal across all posts, or null",
    "topConcern": "strongest objection/concern across all posts, or null",
    "notableQuestions": ["audience questions that reveal intent or unmet need"],
    "commentDriverVerdict": "what the comments collectively say about idea-market fit"
  },
  "audienceObservations": ["concrete cross-post observations"],
  "ideaValidationVerdict": "validated" | "mixed" | "invalidated" | "inconclusive",
  "verdictReasoning": "venture-level verdict, grounded in comment patterns across posts first and metrics second",
  "startupImprovements": [
    { "area": "positioning|product|pricing|audience|channel|messaging", "suggestion": "concrete actionable change", "priority": "high|medium|low" }
  ],
  "perPostHighlights": [
    { "assetId": "<assetId>", "headline": "one-line takeaway about that specific post", "signal": "weak|moderate|strong" }
  ]
}`,
    '',
    'totalEngagement values must match the totals provided exactly. perPostHighlights must include one entry per post using the exact assetId given. Sentiment numbers must add to ~100. Improvements must be derived from comment patterns observed across posts, not generic advice.',
  ].join('\n')

  const model = getFlashModel(8192)
  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
    ],
  })

  const text = result.response.text()
  const parsed = aggregateValidationSchema.safeParse(extractJSON(text))
  if (!parsed.success) {
    throw new Error('Aggregate validation analyzer returned invalid JSON')
  }
  return parsed.data
}
