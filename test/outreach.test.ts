import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IMAGE_STYLE,
  IMAGE_STYLE_PRESETS,
  buildImagePrompt,
  isImageAspect,
  isImageStyle,
} from '@/lib/marketing-image-gen'
import { buildBrandKit, readBrandVoice, renderBrandVoiceBlock } from '@/lib/brand-kit'
import { personalizeEmail, personalizeSubject } from '@/lib/email-generator'

// Pure logic behind the outreach upgrade. The two things worth locking down
// are (a) ventures with no inspiration/voice data behave exactly as before,
// and (b) founder-supplied text that reaches a model prompt stays bounded.

describe('buildBrandKit', () => {
  it('returns an empty palette for a venture with no design data', () => {
    expect(buildBrandKit({}).colors).toEqual([])
  })

  it('skips low-confidence extractions rather than steering on a bad hex', () => {
    const kit = buildBrandKit({
      inspirationTokens: { colors: { primary: { hex: '#635bff', confidence: 20 } } },
    })
    expect(kit.colors).toEqual([])
  })

  it('keeps confident colours in primary/secondary/accent order', () => {
    const kit = buildBrandKit({
      inspirationTokens: {
        colors: {
          primary: { hex: '#635bff', confidence: 90 },
          accent: { hex: '#0a2540', confidence: 80 },
        },
      },
    })
    expect(kit.colors).toEqual(['#635bff', '#0a2540'])
  })

  it('de-duplicates case-insensitively for near-monochrome pages', () => {
    const kit = buildBrandKit({
      inspirationTokens: {
        colors: {
          primary: { hex: '#635BFF', confidence: 90 },
          accent: { hex: '#635bff', confidence: 90 },
        },
      },
    })
    expect(kit.colors).toEqual(['#635BFF'])
  })

  it('still reads the pre-pivot branding palette', () => {
    const kit = buildBrandKit({ branding: { colorPalette: ['#112233', { hex: '#445566' }] } })
    expect(kit.colors).toEqual(['#112233', '#445566'])
  })

  it('ignores malformed palette entries instead of throwing', () => {
    expect(buildBrandKit({ branding: { colorPalette: ['nope', null, 42, {}] } }).colors).toEqual([])
    expect(buildBrandKit({ inspirationTokens: 'not-an-object' }).colors).toEqual([])
  })
})

describe('brand voice', () => {
  it('renders nothing when unset, so prompts are unchanged', () => {
    expect(renderBrandVoiceBlock(readBrandVoice({}))).toBe('')
  })

  it('falls back to safe defaults on unrecognised enum values', () => {
    const voice = readBrandVoice({ brandVoice: { pov: 'shouting', emojiPolicy: 'chaotic' } })
    expect(voice.pov).toBe('neutral')
    expect(voice.emojiPolicy).toBe('sparing')
  })

  it('de-duplicates and caps word lists', () => {
    const voice = readBrandVoice({
      brandVoice: { bannedWords: ['synergy', 'synergy', 'leverage'] },
    })
    expect(voice.bannedWords).toEqual(['synergy', 'leverage'])
  })

  it('surfaces banned words as a hard directive', () => {
    const block = renderBrandVoiceBlock(readBrandVoice({ brandVoice: { bannedWords: ['synergy'] } }))
    expect(block).toContain('NEVER use these words')
    expect(block).toContain('synergy')
  })
})

describe('buildImagePrompt', () => {
  const base = { caption: 'Ship faster #build #startup', ventureName: 'Acme' }

  it('defaults to the editorial preset that predates the style picker', () => {
    expect(DEFAULT_IMAGE_STYLE).toBe('editorial_photo')
    expect(buildImagePrompt(base)).toContain(
      IMAGE_STYLE_PRESETS.editorial_photo.style.slice(0, 40)
    )
  })

  it('strips hashtags out of the caption before describing the scene', () => {
    expect(buildImagePrompt(base)).not.toContain('#build')
  })

  it('uses the generic palette line when the venture has no brand colours', () => {
    expect(buildImagePrompt(base)).toContain('refined, modern palette')
  })

  it('injects the brand palette when there is one', () => {
    expect(buildImagePrompt({ ...base, brandColors: ['#635bff'] })).toContain('#635bff')
  })

  it('keeps the hard rules regardless of style', () => {
    for (const style of Object.keys(IMAGE_STYLE_PRESETS) as Array<keyof typeof IMAGE_STYLE_PRESETS>) {
      expect(buildImagePrompt({ ...base, style })).toContain('do NOT include any of these')
    }
  })

  it('frames square by default and honours other aspects', () => {
    expect(buildImagePrompt(base)).toContain('1:1 square')
    expect(buildImagePrompt({ ...base, aspect: '4:5' })).toContain('4:5 portrait')
  })

  it('caps founder-supplied art direction', () => {
    const prompt = buildImagePrompt({ ...base, artDirection: 'x'.repeat(900) })
    expect(prompt).not.toContain('x'.repeat(401))
    expect(prompt).toContain('x'.repeat(400))
  })

  it('strips control characters from art direction', () => {
    const prompt = buildImagePrompt({ ...base, artDirection: 'warm\u0000 light\u001F' })
    expect(prompt).toContain('warm light')
    expect(prompt).not.toContain('\u0000')
  })
})

describe('payload guards', () => {
  it('rejects styles and aspects that are not in the enum', () => {
    expect(isImageStyle('bold_graphic')).toBe(true)
    expect(isImageStyle('../../etc/passwd')).toBe(false)
    expect(isImageStyle(undefined)).toBe(false)
    expect(isImageAspect('4:5')).toBe(true)
    expect(isImageAspect('9:16')).toBe(false)
  })
})

describe('merge tokens', () => {
  const lead = { firstName: 'Sarah', company: 'Acme', jobTitle: 'CTO', lastName: 'Chen' }

  it('substitutes the original three tokens as before', () => {
    expect(personalizeEmail('Hi {{firstName}} at {{company}}, {{jobTitle}}', lead))
      .toBe('Hi Sarah at Acme, CTO')
  })

  it('falls back to generic wording for missing fields', () => {
    expect(personalizeEmail('Hi {{firstName}} at {{company}}', { firstName: 'Sarah' }))
      .toBe('Hi Sarah at your company')
  })

  it('supports the added tokens', () => {
    expect(personalizeEmail('{{firstName}} {{lastName}} — {{ventureName}}', {
      ...lead,
      ventureName: 'Forze',
    })).toBe('Sarah Chen — Forze')
  })

  it('HTML-escapes substituted values in the body', () => {
    const out = personalizeEmail('Hi {{firstName}}', { firstName: '<script>alert(1)</script>' })
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
  })

  it('strips CRLF from subjects so headers cannot be injected', () => {
    const out = personalizeSubject('Hey {{firstName}}', { firstName: 'Bad\r\nBcc: x@y.com' })
    expect(out).not.toMatch(/[\r\n]/)
  })
})
