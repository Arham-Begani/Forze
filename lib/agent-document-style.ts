import { readFileSync } from 'fs'
import path from 'path'

function loadDocumentStyleGuide(): string {
  try {
    return readFileSync(
      path.join(process.cwd(), 'docs', 'agent-pdf-style-guide.md'),
      'utf8'
    ).trim()
  } catch {
    return [
      '# Forze Agent Document Style Guide',
      '',
      'Write professional Markdown with a single title, clear section headings, short paragraphs, simple lists, compact tables, and a final recommended next steps section.',
    ].join('\n')
  }
}

export const DOCUMENT_STYLE_GUIDE = loadDocumentStyleGuide()
