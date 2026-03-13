// app/api/investor-kit/[code]/route.ts
// Public route — no auth required. Returns investor kit data by access code.
import { getInvestorKitByCode, incrementKitViews } from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params

        if (!code || code.length !== 6) {
            return NextResponse.json({ error: 'Invalid access code' }, { status: 400 })
        }

        const kit = await getInvestorKitByCode(code.toUpperCase())
        if (!kit) {
            return NextResponse.json({ error: 'Kit not found or expired' }, { status: 404 })
        }

        // Increment view counter
        await incrementKitViews(kit.id)

        // Return kit data + venture summary (no sensitive data)
        const venture = kit.venture
        const ctx = venture?.context as any

        return NextResponse.json({
            kit: {
                id: kit.id,
                kitData: kit.kit_data,
                views: kit.views + 1,
                createdAt: kit.created_at,
            },
            venture: {
                name: venture?.name,
                brandName: ctx?.branding?.brandName,
                tagline: ctx?.branding?.tagline,
                brandColors: ctx?.branding?.colorPalette,
            },
        })
    } catch (e) {
        console.error('Public kit access error:', e)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
