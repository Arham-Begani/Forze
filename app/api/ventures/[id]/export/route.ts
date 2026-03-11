// app/api/ventures/[id]/export/route.ts
import { requireAuth, isAuthError } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { generateUnifiedPDF } from '@/lib/pdf-export'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params

        const venture = await getVenture(id, session.userId)
        if (!venture) {
            return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
        }

        const pdfBuffer = await generateUnifiedPDF(venture.name, venture.context)

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${venture.name.replace(/\s+/g, '_')}_Dossier.pdf"`,
            },
        })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        console.error('PDF Export Error:', e)
        return NextResponse.json({ error: 'Internal error during export' }, { status: 500 })
    }
}
