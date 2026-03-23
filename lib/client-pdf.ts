import { jsPDF } from 'jspdf'
import { buildSectionsFromResult, PDFSection, renderStyledPDFDocument } from '@/lib/pdf-document'

export function downloadPDF(title: string, sections: PDFSection[], filename?: string) {
  const doc = new jsPDF()
  renderStyledPDFDocument(doc, title, sections)

  const safeName = (filename || title).replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')
  doc.save(`${safeName}.pdf`)
}

export function downloadPDFFromElement(title: string, element: HTMLElement, filename?: string) {
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

  downloadPDF(title, sections, filename)
}

export function downloadPDFFromResult(title: string, result: Record<string, any>, filename?: string) {
  const sections = buildSectionsFromResult(title, result)
  downloadPDF(title, sections, filename)
}
