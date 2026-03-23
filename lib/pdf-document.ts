import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

export interface PDFSection {
  title: string
  content: string
}

type PDFDoc = jsPDF & {
  autoTable?: (options: Record<string, unknown>) => void
  lastAutoTable?: { finalY?: number }
}

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'quote'; text: string }
  | { type: 'keyValue'; label: string; value: string }

const palette = {
  ink: [28, 28, 28] as const,
  muted: [92, 92, 92] as const,
  subtle: [130, 130, 130] as const,
  border: [224, 224, 224] as const,
  accent: [192, 122, 58] as const,
  accentSoft: [246, 237, 227] as const,
  cover: [19, 22, 26] as const,
  white: [255, 255, 255] as const,
}

function cleanInline(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/[•●▪]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function prettyLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())
    .trim()
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cleanInline(cell.trim()))
}

function isTableSeparator(line: string): boolean {
  return /^\|?(\s*:?-{3,}:?\s*\|)+\s*$/.test(line.trim())
}

function isListItem(line: string): boolean {
  return /^[-*]\s+/.test(line.trim()) || /^\d+\.\s+/.test(line.trim())
}

function isPotentialKeyValue(line: string): boolean {
  return /^(\*\*)?[A-Za-z][A-Za-z0-9 /&()'-]{1,40}(\*\*)?:\s+\S+/.test(line.trim())
}

function isBlockStart(line: string, nextLine?: string): boolean {
  const trimmed = line.trim()
  return (
    /^#{1,3}\s+/.test(trimmed) ||
    /^>\s+/.test(trimmed) ||
    isListItem(trimmed) ||
    (trimmed.includes('|') && !!nextLine && isTableSeparator(nextLine)) ||
    isPotentialKeyValue(trimmed)
  )
}

function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: cleanInline(headingMatch[2]),
      })
      index += 1
      continue
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('> ')) {
        quoteLines.push(cleanInline(lines[index].trim().replace(/^>\s+/, '')))
        index += 1
      }
      blocks.push({ type: 'quote', text: quoteLines.join(' ') })
      continue
    }

    if (trimmed.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const tableLines = [lines[index]]
      index += 2
      while (index < lines.length && lines[index].trim().includes('|')) {
        tableLines.push(lines[index])
        index += 1
      }
      const rows = tableLines.map(splitTableRow).filter((row) => row.length > 0)
      if (rows.length > 0) {
        blocks.push({ type: 'table', rows })
      }
      continue
    }

    if (isListItem(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed)
      const items: string[] = []
      while (index < lines.length && isListItem(lines[index].trim())) {
        items.push(cleanInline(lines[index].trim().replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')))
        index += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    if (isPotentialKeyValue(trimmed)) {
      const normalized = cleanInline(trimmed.replace(/\*\*/g, ''))
      const separatorIndex = normalized.indexOf(': ')
      blocks.push({
        type: 'keyValue',
        label: normalized.slice(0, separatorIndex),
        value: normalized.slice(separatorIndex + 2),
      })
      index += 1
      continue
    }

    const paragraphLines: string[] = [trimmed]
    index += 1
    while (index < lines.length) {
      const nextLine = lines[index]
      const nextTrimmed = nextLine.trim()
      if (!nextTrimmed) {
        index += 1
        break
      }
      if (isBlockStart(nextTrimmed, lines[index + 1]?.trim())) {
        break
      }
      paragraphLines.push(nextTrimmed)
      index += 1
    }
    blocks.push({ type: 'paragraph', text: cleanInline(paragraphLines.join(' ')) })
  }

  return blocks
}

function linesHeight(count: number, lineHeight: number): number {
  return Math.max(count, 1) * lineHeight
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function listSection(label: string, items: string[]): string {
  if (!items.length) return ''
  return [`## ${label}`, ...items.map((item) => `- ${item}`)].join('\n')
}

function tableSection(label: string, headers: string[], rows: string[][]): string {
  if (!rows.length) return ''
  const divider = headers.map(() => '---')
  return [
    `## ${label}`,
    `| ${headers.join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function joinParts(parts: Array<string | undefined>): string {
  return parts.filter((part) => part && part.trim()).join('\n\n')
}

function buildResearchSection(research: Record<string, any>): PDFSection {
  const summary = [
    '## Snapshot',
    `Market Summary: ${formatValue(research.marketSummary)}`,
    `TAM: ${formatValue(research.tam?.value)}${research.tam?.source ? ` (${research.tam.source})` : ''}`,
    `SAM: ${formatValue(research.sam?.value)}${research.sam?.source ? ` (${research.sam.source})` : ''}`,
    `SOM: ${formatValue(research.som?.value)}`,
    `Recommended Concept: ${formatValue(research.recommendedConcept)}`,
    `Market Gap: ${formatValue(research.competitorGap)}`,
  ].filter((line) => !line.endsWith(': '))

  const painPoints = Array.isArray(research.painPoints)
    ? research.painPoints.map((point: Record<string, unknown>) => {
        const description = formatValue(point.description)
        const source = formatValue(point.source)
        const frequency = formatValue(point.frequency)
        return [description, source ? `source: ${source}` : '', frequency ? `frequency: ${frequency}` : '']
          .filter(Boolean)
          .join(' | ')
      })
    : []

  const competitors = Array.isArray(research.competitors)
    ? research.competitors.map((competitor: Record<string, unknown>) => [
        formatValue(competitor.name),
        formatValue(competitor.positioning),
        formatValue(competitor.weakness),
      ])
    : []

  const riskMatrix = Array.isArray(research.riskMatrix)
    ? research.riskMatrix.map((risk: Record<string, unknown>) => [
        formatValue(risk.risk),
        formatValue(risk.likelihood),
        formatValue(risk.impact),
        formatValue(risk.score),
      ])
    : []

  const topConcepts = Array.isArray(research.topConcepts)
    ? research.topConcepts.map((concept: Record<string, unknown>) => [
        formatValue(concept.name),
        formatValue(concept.opportunityScore),
        formatValue(concept.rationale),
      ])
    : []

  const swot = research.swot ?? {}

  return {
    title: 'Market Intelligence',
    content: joinParts([
      summary.join('\n'),
      listSection('Customer Pain Points', painPoints),
      tableSection('Competitor Map', ['Competitor', 'Positioning', 'Weakness'], competitors),
      listSection('Strengths', Array.isArray(swot.strengths) ? swot.strengths : []),
      listSection('Weaknesses', Array.isArray(swot.weaknesses) ? swot.weaknesses : []),
      listSection('Opportunities', Array.isArray(swot.opportunities) ? swot.opportunities : []),
      listSection('Threats', Array.isArray(swot.threats) ? swot.threats : []),
      tableSection('Risk Matrix', ['Risk', 'Likelihood', 'Impact', 'Score'], riskMatrix),
      tableSection('Top Concepts', ['Concept', 'Score', 'Rationale'], topConcepts),
      formatValue(research.researchPaper),
    ]),
  }
}

function buildBrandingSection(branding: Record<string, any>): PDFSection {
  const paletteRows = Array.isArray(branding.colorPalette)
    ? branding.colorPalette.map((color: Record<string, unknown>) => [
        formatValue(color.name),
        formatValue(color.hex),
        formatValue(color.role),
        formatValue(color.psychology),
      ])
    : []

  return {
    title: 'Brand Identity',
    content: joinParts([
      [
        '## Snapshot',
        `Brand Name: ${formatValue(branding.brandName)}`,
        `Tagline: ${formatValue(branding.tagline)}`,
        `Archetype: ${formatValue(branding.brandArchetype)}`,
        `Mission: ${formatValue(branding.missionStatement)}`,
      ]
        .filter((line) => !line.endsWith(': '))
        .join('\n'),
      listSection('Name Candidates', Array.isArray(branding.nameCandidates) ? branding.nameCandidates : []),
      listSection('Brand Personality', Array.isArray(branding.brandPersonality) ? branding.brandPersonality : []),
      [
        '## Tone Of Voice',
        `Description: ${formatValue(branding.toneOfVoice?.description)}`,
      ].join('\n'),
      listSection('Do Examples', Array.isArray(branding.toneOfVoice?.doExamples) ? branding.toneOfVoice.doExamples : []),
      listSection('Dont Examples', Array.isArray(branding.toneOfVoice?.dontExamples) ? branding.toneOfVoice.dontExamples : []),
      tableSection('Color Palette', ['Name', 'Hex', 'Role', 'Psychology'], paletteRows),
      [
        '## Typography',
        `Display Font: ${formatValue(branding.typography?.displayFont)}`,
        `Body Font: ${formatValue(branding.typography?.bodyFont)}`,
        `Usage Rules: ${formatValue(branding.typography?.usageRules)}`,
      ]
        .filter((line) => !line.endsWith(': '))
        .join('\n'),
      listSection('Logo Concepts', Array.isArray(branding.logoConceptDescriptions) ? branding.logoConceptDescriptions : []),
      [
        '## UI Kit',
        `Border Radius: ${formatValue(branding.uiKitSpec?.borderRadius)}`,
        `Spacing: ${formatValue(branding.uiKitSpec?.spacing)}`,
        `Button Style: ${formatValue(branding.uiKitSpec?.buttonStyle)}`,
        `Card Style: ${formatValue(branding.uiKitSpec?.cardStyle)}`,
      ]
        .filter((line) => !line.endsWith(': '))
        .join('\n'),
      formatValue(branding.brandBible),
    ]),
  }
}

function buildMarketingSection(marketing: Record<string, any>): PDFSection {
  const weekRows = Array.isArray(marketing.gtmStrategy?.weeks)
    ? marketing.gtmStrategy.weeks.map((week: Record<string, unknown>) => [
        formatValue(week.week),
        formatValue(week.theme),
        Array.isArray(week.actions) ? week.actions.join('; ') : '',
        Array.isArray(week.kpis) ? week.kpis.join('; ') : '',
      ])
    : []

  const emailRows = Array.isArray(marketing.emailSequence)
    ? marketing.emailSequence.map((email: Record<string, unknown>) => [
        formatValue(email.day),
        formatValue(email.subject),
        formatValue(email.preview),
      ])
    : []

  return {
    title: 'Marketing Strategy',
    content: joinParts([
      [
        '## Snapshot',
        `Overview: ${formatValue(marketing.gtmStrategy?.overview)}`,
      ].filter((line) => !line.endsWith(': ')).join('\n'),
      tableSection('30-Day Roadmap', ['Week', 'Theme', 'Actions', 'KPIs'], weekRows),
      tableSection('Email Sequence', ['Day', 'Subject', 'Preview'], emailRows),
      listSection('X Hashtags', Array.isArray(marketing.hashtagStrategy?.x) ? marketing.hashtagStrategy.x : []),
      listSection('LinkedIn Hashtags', Array.isArray(marketing.hashtagStrategy?.linkedin) ? marketing.hashtagStrategy.linkedin : []),
      listSection('Instagram Hashtags', Array.isArray(marketing.hashtagStrategy?.instagram) ? marketing.hashtagStrategy.instagram : []),
      formatValue(marketing.marketingPlan),
    ]),
  }
}

function buildLandingSection(landing: Record<string, any>): PDFSection {
  const featureList = Array.isArray(landing.landingPageCopy?.features)
    ? landing.landingPageCopy.features.map((feature: Record<string, unknown>) => {
        const title = formatValue(feature.title)
        const description = formatValue(feature.description)
        return title ? `**${title}:** ${description}` : description
      })
    : []

  const pricingRows = Array.isArray(landing.landingPageCopy?.pricing)
    ? landing.landingPageCopy.pricing.map((tier: Record<string, unknown>) => [
        formatValue(tier.tier),
        formatValue(tier.price),
        formatValue(tier.cta),
      ])
    : []

  const sitemapRows = Array.isArray(landing.sitemap)
    ? landing.sitemap.map((page: Record<string, unknown>) => [
        formatValue(page.page),
        formatValue(page.path),
        formatValue(page.purpose),
      ])
    : []

  return {
    title: 'Product Pipeline',
    content: joinParts([
      [
        '## Hero',
        `Headline: ${formatValue(landing.landingPageCopy?.hero?.headline)}`,
        `Subheadline: ${formatValue(landing.landingPageCopy?.hero?.subheadline)}`,
        `Primary CTA: ${formatValue(landing.landingPageCopy?.hero?.ctaPrimary)}`,
        `Secondary CTA: ${formatValue(landing.landingPageCopy?.hero?.ctaSecondary)}`,
      ]
        .filter((line) => !line.endsWith(': '))
        .join('\n'),
      listSection('Features', featureList),
      listSection('Social Proof', Array.isArray(landing.landingPageCopy?.socialProof) ? landing.landingPageCopy.socialProof : []),
      tableSection('Pricing', ['Tier', 'Price', 'CTA'], pricingRows),
      listSection(
        'FAQ',
        Array.isArray(landing.landingPageCopy?.faq)
          ? landing.landingPageCopy.faq.map((item: Record<string, unknown>) => `${formatValue(item.question)} - ${formatValue(item.answer)}`)
          : []
      ),
      tableSection('Sitemap', ['Page', 'Path', 'Purpose'], sitemapRows),
      [
        '## Delivery',
        `Deployment URL: ${formatValue(landing.deploymentUrl)}`,
        `Lead Capture Active: ${formatValue(landing.leadCaptureActive)}`,
        `Analytics Active: ${formatValue(landing.analyticsActive)}`,
        `SEO Title: ${formatValue(landing.seoMetadata?.title)}`,
        `SEO Description: ${formatValue(landing.seoMetadata?.description)}`,
      ]
        .filter((line) => !line.endsWith(': '))
        .join('\n'),
      listSection('SEO Keywords', Array.isArray(landing.seoMetadata?.keywords) ? landing.seoMetadata.keywords : []),
    ]),
  }
}

function buildFeasibilitySection(feasibility: Record<string, any>): PDFSection {
  const riskRows = Array.isArray(feasibility.risks)
    ? feasibility.risks.map((risk: Record<string, unknown>) => [
        formatValue(risk.category),
        formatValue(risk.risk),
        formatValue(risk.likelihood),
        formatValue(risk.impact),
        formatValue(risk.mitigation),
      ])
    : []

  return {
    title: 'Strategic Feasibility',
    content: joinParts([
      [
        '## Verdict',
        `Verdict: ${formatValue(feasibility.verdict)}`,
        `Rationale: ${formatValue(feasibility.verdictRationale)}`,
        `Market Timing Score: ${formatValue(feasibility.marketTimingScore)}`,
        `Market Timing Rationale: ${formatValue(feasibility.marketTimingRationale)}`,
      ]
        .filter((line) => !line.endsWith(': '))
        .join('\n'),
      [
        '## Financial Model',
        `CAC: ${formatValue(feasibility.financialModel?.cac)}`,
        `LTV: ${formatValue(feasibility.financialModel?.ltv)}`,
        `LTV:CAC Ratio: ${formatValue(feasibility.financialModel?.ltvCacRatio)}`,
        `Break Even Month: ${formatValue(feasibility.financialModel?.breakEvenMonth)}`,
        `Year 1 Revenue: ${formatValue(feasibility.financialModel?.yearOne?.revenue)}`,
        `Year 2 Revenue: ${formatValue(feasibility.financialModel?.yearTwo?.revenue)}`,
        `Year 3 Revenue: ${formatValue(feasibility.financialModel?.yearThree?.revenue)}`,
      ]
        .filter((line) => !line.endsWith(': '))
        .join('\n'),
      tableSection('Risk Matrix', ['Category', 'Risk', 'Likelihood', 'Impact', 'Mitigation'], riskRows),
      listSection('Key Assumptions', Array.isArray(feasibility.keyAssumptions) ? feasibility.keyAssumptions : []),
      listSection('Key Risks To Monitor', Array.isArray(feasibility.keyRisksToMonitor) ? feasibility.keyRisksToMonitor : []),
      [
        '## Strategic Notes',
        `Competitive Moat: ${formatValue(feasibility.competitiveMoat)}`,
        `Regulatory Landscape: ${formatValue(feasibility.regulatoryLandscape)}`,
      ]
        .filter((line) => !line.endsWith(': '))
        .join('\n'),
      formatValue(feasibility.feasibilityReport),
    ]),
  }
}

function buildInvestorKitSection(kit: Record<string, any>): PDFSection {
  const deckRows = Array.isArray(kit.pitchDeckOutline)
    ? kit.pitchDeckOutline.map((slide: Record<string, unknown>) => [
        formatValue(slide.slide),
        formatValue(slide.content),
      ])
    : []

  return {
    title: 'Investor Kit',
    content: joinParts([
      [
        '## Executive Summary',
        formatValue(kit.executiveSummary),
      ].filter(Boolean).join('\n'),
      tableSection('Pitch Deck Outline', ['Slide', 'Content'], deckRows),
      [
        '## The Ask',
        `Suggested Raise: ${formatValue(kit.askDetails?.suggestedRaise)}`,
      ]
        .filter((line) => !line.endsWith(': '))
        .join('\n'),
      listSection('Use Of Funds', Array.isArray(kit.askDetails?.useOfFunds) ? kit.askDetails.useOfFunds : []),
      listSection('Key Milestones', Array.isArray(kit.askDetails?.keyMilestones) ? kit.askDetails.keyMilestones : []),
      listSection('Data Room Sections', Array.isArray(kit.dataRoomSections) ? kit.dataRoomSections : []),
      formatValue(kit.onePageMemo),
    ]),
  }
}

function buildGenericSection(title: string, value: unknown): PDFSection | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    return { title, content: value }
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { title, content: String(value) }
  }
  if (Array.isArray(value)) {
    return {
      title,
      content: value.map((item) => `- ${cleanInline(typeof item === 'string' ? item : JSON.stringify(item))}`).join('\n'),
    }
  }
  const objectValue = value as Record<string, unknown>
  const lines: string[] = []
  for (const [key, nestedValue] of Object.entries(objectValue)) {
    if (nestedValue === null || nestedValue === undefined || key === 'fullComponent') continue
    if (typeof nestedValue === 'string' || typeof nestedValue === 'number' || typeof nestedValue === 'boolean') {
      lines.push(`${prettyLabel(key)}: ${nestedValue}`)
      continue
    }
    if (Array.isArray(nestedValue)) {
      lines.push(`## ${prettyLabel(key)}`)
      if (nestedValue.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')) {
        lines.push(...nestedValue.map((item) => `- ${String(item)}`))
      } else {
        nestedValue.forEach((item, index) => {
          lines.push(`### Item ${index + 1}`)
          lines.push(cleanInline(JSON.stringify(item)))
        })
      }
      continue
    }
    lines.push(`## ${prettyLabel(key)}`)
    lines.push(cleanInline(JSON.stringify(nestedValue)))
  }
  return lines.length ? { title, content: lines.join('\n\n') } : null
}

function hasVentureModules(result: Record<string, unknown>): boolean {
  return ['research', 'branding', 'marketing', 'landing', 'feasibility', 'investorKit'].some((key) => key in result)
}

export function buildSectionsFromResult(title: string, result: Record<string, any>): PDFSection[] {
  if (hasVentureModules(result)) {
    const sections = [
      result.research ? buildResearchSection(result.research) : null,
      result.branding ? buildBrandingSection(result.branding) : null,
      result.marketing ? buildMarketingSection(result.marketing) : null,
      result.landing ? buildLandingSection(result.landing) : null,
      result.feasibility ? buildFeasibilitySection(result.feasibility) : null,
      result.investorKit ? buildInvestorKitSection(result.investorKit) : null,
    ]
    return sections.filter((section): section is PDFSection => !!section)
  }

  if ('researchPaper' in result) return [buildResearchSection(result)]
  if ('brandBible' in result) return [buildBrandingSection(result)]
  if ('marketingPlan' in result) return [buildMarketingSection(result)]
  if ('landingPageCopy' in result) return [buildLandingSection(result)]
  if ('feasibilityReport' in result) return [buildFeasibilitySection(result)]
  if ('onePageMemo' in result) return [buildInvestorKitSection(result)]

  const sections: PDFSection[] = []
  for (const [key, value] of Object.entries(result)) {
    const section = buildGenericSection(prettyLabel(key), value)
    if (section) sections.push(section)
  }

  if (sections.length === 0) {
    sections.push({ title, content: cleanInline(JSON.stringify(result, null, 2)) })
  }

  return sections
}

export function renderStyledPDFDocument(doc: jsPDF, title: string, sections: PDFSection[]): void {
  const pdf = doc as PDFDoc
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 18
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const setTextColor = (color: readonly [number, number, number]) => {
    doc.setTextColor(color[0], color[1], color[2])
  }

  const addContentPage = () => {
    doc.addPage()
    y = margin + 12
    doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2])
    doc.setLineWidth(0.3)
    doc.line(margin, margin, pageWidth - margin, margin)
  }

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - margin) {
      addContentPage()
    }
  }

  const drawWrappedText = (
    text: string,
    options: { fontSize: number; lineHeight: number; x?: number; width?: number; bold?: boolean; color?: readonly [number, number, number] }
  ) => {
    const x = options.x ?? margin
    const width = options.width ?? contentWidth
    const lines = doc.splitTextToSize(text, width)
    ensureSpace(linesHeight(lines.length, options.lineHeight))
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal')
    doc.setFontSize(options.fontSize)
    setTextColor(options.color ?? palette.ink)
    doc.text(lines, x, y)
    y += linesHeight(lines.length, options.lineHeight)
  }

  const drawParagraph = (text: string) => {
    drawWrappedText(cleanInline(text), {
      fontSize: 10.5,
      lineHeight: 5.4,
      color: palette.muted,
    })
    y += 2
  }

  const drawHeading = (text: string, level: 1 | 2 | 3) => {
    const styleByLevel = {
      1: { fontSize: 17, gapTop: 4, gapBottom: 4 },
      2: { fontSize: 14, gapTop: 5, gapBottom: 3 },
      3: { fontSize: 11.5, gapTop: 3, gapBottom: 2 },
    }[level]
    y += styleByLevel.gapTop
    drawWrappedText(cleanInline(text), {
      fontSize: styleByLevel.fontSize,
      lineHeight: level === 1 ? 7 : 6,
      bold: true,
      color: palette.ink,
    })
    y += styleByLevel.gapBottom
  }

  const drawList = (items: string[], ordered: boolean) => {
    items.forEach((item, index) => {
      const marker = ordered ? `${index + 1}.` : '•'
      const markerWidth = 7
      const lines = doc.splitTextToSize(cleanInline(item), contentWidth - markerWidth)
      ensureSpace(linesHeight(lines.length, 5.3) + 1)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(palette.accent[0], palette.accent[1], palette.accent[2])
      doc.text(marker, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10.2)
      setTextColor(palette.muted)
      doc.text(lines, margin + markerWidth, y)
      y += linesHeight(lines.length, 5.3) + 1.5
    })
    y += 1
  }

  const drawKeyValue = (label: string, value: string) => {
    ensureSpace(12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    setTextColor(palette.subtle)
    doc.text(cleanInline(label).toUpperCase(), margin, y)
    y += 4
    drawWrappedText(cleanInline(value), {
      fontSize: 10.3,
      lineHeight: 5.2,
      color: palette.ink,
    })
    y += 1.5
  }

  const drawQuote = (text: string) => {
    const lines = doc.splitTextToSize(cleanInline(text), contentWidth - 10)
    const height = linesHeight(lines.length, 5.2) + 8
    ensureSpace(height)
    doc.setFillColor(palette.accentSoft[0], palette.accentSoft[1], palette.accentSoft[2])
    doc.rect(margin, y - 4, contentWidth, height, 'F')
    doc.setFillColor(palette.accent[0], palette.accent[1], palette.accent[2])
    doc.rect(margin, y - 4, 2.5, height, 'F')
    drawWrappedText(cleanInline(text), {
      fontSize: 10.2,
      lineHeight: 5.2,
      x: margin + 6,
      width: contentWidth - 10,
      color: palette.ink,
    })
    y += 4
  }

  const drawTable = (rows: string[][]) => {
    if (rows.length < 2) {
      drawList(rows.flat(), false)
      return
    }
    if (!pdf.autoTable) {
      drawParagraph(rows.map((row) => row.join(' | ')).join('\n'))
      return
    }
    ensureSpace(20)
    pdf.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [rows[0]],
      body: rows.slice(1),
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 2.4,
        textColor: palette.muted,
        lineColor: palette.border,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: palette.accentSoft,
        textColor: palette.ink,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [252, 252, 252],
      },
    })
    y = (pdf.lastAutoTable?.finalY ?? y) + 7
  }

  doc.setFillColor(palette.cover[0], palette.cover[1], palette.cover[2])
  doc.rect(0, 0, pageWidth, pageHeight, 'F')
  doc.setFillColor(palette.accent[0], palette.accent[1], palette.accent[2])
  doc.rect(margin, 62, 42, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  setTextColor(palette.white)
  doc.text(doc.splitTextToSize(cleanInline(title), contentWidth), margin, 84)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  setTextColor([194, 194, 194])
  doc.text('Forze Venture Dossier', margin, 108)
  doc.text(new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date()), margin, pageHeight - 24)

  addContentPage()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  setTextColor(palette.ink)
  doc.text('Contents', margin, y)
  y += 10
  sections.forEach((section, index) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    setTextColor(palette.muted)
    doc.text(`${index + 1}. ${cleanInline(section.title)}`, margin, y)
    y += 7
  })

  sections.forEach((section, index) => {
    addContentPage()
    doc.setFillColor(palette.accentSoft[0], palette.accentSoft[1], palette.accentSoft[2])
    doc.roundedRect(margin, y - 3, contentWidth, 18, 2, 2, 'F')
    doc.setFillColor(palette.accent[0], palette.accent[1], palette.accent[2])
    doc.rect(margin, y - 3, 3, 18, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    setTextColor(palette.subtle)
    doc.text(`SECTION ${index + 1}`, margin + 8, y + 2.5)
    doc.setFontSize(16)
    setTextColor(palette.ink)
    doc.text(cleanInline(section.title), margin + 8, y + 10)
    y += 24

    const blocks = parseMarkdown(section.content)
    blocks.forEach((block) => {
      switch (block.type) {
        case 'heading':
          drawHeading(block.text, block.level)
          break
        case 'paragraph':
          drawParagraph(block.text)
          break
        case 'list':
          drawList(block.items, block.ordered)
          break
        case 'table':
          drawTable(block.rows)
          break
        case 'quote':
          drawQuote(block.text)
          break
        case 'keyValue':
          drawKeyValue(block.label, block.value)
          break
      }
    })
  })

  const totalPages = doc.getNumberOfPages()
  for (let page = 2; page <= totalPages; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2])
    doc.setLineWidth(0.2)
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setTextColor(palette.subtle)
    doc.text(`${cleanInline(title)} | Forze`, margin, pageHeight - 8)
    doc.text(`${page - 1}/${totalPages - 1}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }
}
