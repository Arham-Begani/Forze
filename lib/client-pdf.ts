import type { PDFSection } from '@/lib/pdf-document'

export type { PDFSection }

export async function downloadPDF(title: string, sections: PDFSection[], filename?: string) {
  const [{ jsPDF }, { renderStyledPDFDocument }] = await Promise.all([
    import('jspdf'),
    import('@/lib/pdf-document'),
  ])

  const doc = new jsPDF()
  renderStyledPDFDocument(doc, title, sections)

  const safeName = (filename || title).replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')
  doc.save(`${safeName}.pdf`)
}

export async function downloadPDFFromElement(title: string, element: HTMLElement, filename?: string) {
  const text = element.innerText || ''
  const sections: PDFSection[] = []
  const parts = text.split(/\n(?=[A-Z][A-Z\s&()]+\n)/)

  if (parts.length <= 1) {
    sections.push({ title, content: text })
  } else {
    for (const part of parts) {
      const lines = part.trim().split('\n')
      const sectionTitle = lines[0] || title
      const sectionContent = lines.slice(1).join('\n')
      if (sectionContent.trim()) {
        sections.push({ title: sectionTitle, content: sectionContent })
      }
    }
  }

  await downloadPDF(title, sections, filename)
}

export async function downloadPDFFromResult(title: string, result: Record<string, any>, filename?: string) {
  const { buildSectionsFromResult } = await import('@/lib/pdf-document')
  const sections = buildSectionsFromResult(title, result)
  await downloadPDF(title, sections, filename)
}
