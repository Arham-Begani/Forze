import { requireAuth, isAuthError } from '@/lib/auth'
import { getCohortById, getVenture } from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params

        const cohort = await getCohortById(id)
        if (!cohort || cohort.user_id !== session.userId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        // Fetch full venture data for each variant
        const variantVentures = await Promise.all(
            cohort.variant_ids.map(async (vid) => {
                const venture = await getVenture(vid, session.userId)
                return venture
            })
        )

        return NextResponse.json({
            ...cohort,
            ventures: variantVentures.filter(Boolean),
        })
    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
