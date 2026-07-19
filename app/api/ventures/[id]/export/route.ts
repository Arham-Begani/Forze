// app/api/ventures/[id]/export/route.ts
import { requireAuth, isAuthError } from '@/lib/auth'
import { getBillingSnapshot } from '@/lib/billing-queries'
import { getVenture } from '@/lib/queries'
import { generateUnifiedPDF } from '@/lib/pdf-export'
import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/log'

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

        const billing = await getBillingSnapshot(session.userId)
        if (!billing.hasUnlimitedAccess && billing.planSlug === 'free') {
            return NextResponse.json({ error: 'PDF export is available on paid plans only' }, { status: 403 })
        }

        const pdfBuffer = await generateUnifiedPDF(venture.name, venture.context)

        return new NextResponse(pdfBuffer as unknown as BodyInit, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${venture.name.replace(/\s+/g, '_')}_Dossier.pdf"`,
            },
        })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        logError('ventures/id/export', e, { msg: 'PDF Export Error' })
        return NextResponse.json({ error: 'Internal error during export' }, { status: 500 })
    }
}
