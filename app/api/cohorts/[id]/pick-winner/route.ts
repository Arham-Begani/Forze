import { requireAuth, isAuthError } from '@/lib/auth'
import { getCohortById, setCohortWinner } from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const pickWinnerSchema = z.object({
    winnerId: z.string().min(1),
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params

        const cohort = await getCohortById(id)
        if (!cohort || cohort.user_id !== session.userId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const body = await request.json()
        const result = pickWinnerSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
        }

        const { winnerId } = result.data

        if (!cohort.variant_ids.includes(winnerId)) {
            return NextResponse.json({ error: 'Winner must be one of the cohort variants' }, { status: 400 })
        }

        await setCohortWinner(id, winnerId)

        const updated = await getCohortById(id)
        return NextResponse.json(updated)
    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
