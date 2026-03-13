import { getVenturePublic } from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const venture = await getVenturePublic(id)
    if (!venture) {
        return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
    }

    const context = venture.context as Record<string, any> | null
    const landing = context?.landing

    if (!landing || !landing.fullComponent) {
        return NextResponse.json(
            { error: 'Landing page not yet generated for this venture' },
            { status: 404 }
        )
    }

    return NextResponse.json({
        name: venture.name,
        landing: {
            fullComponent: landing.fullComponent,
            seoMetadata: landing.seoMetadata || {},
            landingPageCopy: landing.landingPageCopy || {},
            deploymentUrl: landing.deploymentUrl,
        },
    })
}
