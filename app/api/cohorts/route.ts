import { requireAuth, isAuthError } from '@/lib/auth'
import { getCohortsByUser, createCohort } from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const createCohortSchema = z.object({
    name: z.string().min(1).max(200),
    coreIdea: z.string().min(1).max(2000),
    projectId: z.string().optional(),
})

export async function GET() {
    try {
        const session = await requireAuth()
        const cohorts = await getCohortsByUser(session.userId)
        return NextResponse.json(cohorts)
    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth()
        const body = await request.json()
        const result = createCohortSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid input', details: result.error.flatten() }, { status: 400 })
        }

        const { name, coreIdea, projectId } = result.data
        const cohort = await createCohort(session.userId, name, coreIdea, projectId)

        return NextResponse.json(cohort, { status: 201 })
    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
