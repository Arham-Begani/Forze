import { jsPDF } from 'jspdf'
import { buildSectionsFromResult, renderStyledPDFDocument } from '@/lib/pdf-document'

interface AgentResult {
  research?: Record<string, unknown> | null
  branding?: Record<string, unknown> | null
  marketing?: Record<string, unknown> | null
  landing?: Record<string, unknown> | null
  feasibility?: Record<string, unknown> | null
  investorKit?: Record<string, unknown> | null
}

export async function generateUnifiedPDF(ventureName: string, results: AgentResult): Promise<Uint8Array> {
  const doc = new jsPDF()
  const sections = buildSectionsFromResult(ventureName, results as Record<string, unknown>)

  renderStyledPDFDocument(doc, ventureName, sections)

  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer)
}
