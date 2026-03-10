// app/api/ventures/route.ts
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import { getVenturesByUser, createVenture } from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET() {
    try {
        const session = await requireAuth()
        const ventures = await getVenturesByUser(session.userId)
        return NextResponse.json(ventures)
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth()
        const { name, projectId } = await request.json()

        const result = z.string().min(1).max(100).safeParse(name)
        if (!result.success) {
            return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
        }

        const venture = await createVenture(session.userId, name, projectId)
        return NextResponse.json(venture, { status: 201 })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
