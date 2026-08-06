// app/api/ventures/[id]/route.ts
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import {
    getVenture,
    getVentureAccess,
    updateVentureName,
    deleteVenture,
    getConversationsByModule,
} from '@/lib/queries'
import { getProjectIdeaVersion } from '@/lib/queries/idea-queries'
import { toVentureDetail } from '@/lib/venture-summary'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const MODULES = [
    'landing',
    'general',
    'shadow-board',
    'investor-kit',
    'launch-autopilot',
    'mvp-scalpel',
] as const

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params
        const venture = await getVenture(id, session.userId)
        if (!venture) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        // ?module=<id> scopes the conversation payload to one module — the
        // module page only ever renders one module's history, so this avoids
        // querying (and shipping) the other modules' conversations.
        const moduleParam = request.nextUrl.searchParams.get('module')
        const requestedModules = MODULES.includes(moduleParam as typeof MODULES[number])
            ? [moduleParam as typeof MODULES[number]]
            : MODULES

        const conversations = await Promise.all(
            requestedModules.map(m => getConversationsByModule(id, m))
        )

        // Current idea version, so the client can flag module output that was
        // built from an older one. Best-effort: null on any failure (or a
        // project predating migration 047) means "no staleness info" and the
        // UI simply shows no badge.
        let currentIdeaVersion: number | null = null
        if (venture.project_id) {
            try {
                currentIdeaVersion = await getProjectIdeaVersion(venture.project_id, session.userId)
            } catch {
                currentIdeaVersion = null
            }
        }

        // toVentureDetail drops `context` — see that function for why. Commit
        // 76afed0 removed the blob from the venture LIST endpoints; this detail
        // endpoint, which the module page hits on every load, was missed.
        return NextResponse.json({
            ...toVentureDetail(venture),
            currentIdeaVersion,
            conversations: Object.fromEntries(requestedModules.map((m, i) => [m, conversations[i]])),
        })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params
        const venture = await getVenture(id, session.userId)
        if (!venture) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        // Only owners and admins can rename a venture — viewers and editors
        // can read it but must not be able to mutate the top-level identity.
        const role = await getVentureAccess(id, session.userId)
        if (role !== 'owner' && role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { name } = await request.json()
        const result = z.string().min(1).max(100).safeParse(name)
        if (!result.success) {
            return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
        }

        await updateVentureName(id, name)
        return NextResponse.json({ ...venture, name })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params
        const venture = await getVenture(id, session.userId)
        if (!venture) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        // Deleting a venture is irreversible — restrict to owners only.
        const role = await getVentureAccess(id, session.userId)
        if (role !== 'owner') {
            return NextResponse.json({ error: 'Only the venture owner can delete it.' }, { status: 403 })
        }

        await deleteVenture(id)
        return new NextResponse(null, { status: 204 })
    } catch (e) {
        if (isAuthError(e)) return e.toResponse()
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
