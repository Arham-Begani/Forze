// app/api/ventures/[id]/investor-kit/route.ts
import { requireAuth, isAuthError } from '@/lib/auth'
import {
    getVenture,
    createInvestorKit,
    getInvestorKitByVenture,
    getProject,
} from '@/lib/queries'
import { runInvestorKitAgent } from '@/agents/investor-kit'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function generateAccessCode(): string {
    return crypto.randomBytes(3).toString('hex').toUpperCase() // 6-char alphanumeric
}

// GET — fetch existing kit for this venture
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params

        const venture = await getVenture(id, session.userId)
        if (!venture) {
            return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
        }

        const kit = await getInvestorKitByVenture(id)
        if (!kit) {
            return NextResponse.json({ kit: null })
        }

        return NextResponse.json({ kit })
    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        // Table may not exist yet — return null gracefully
        console.warn('Investor kit GET error (table may not exist):', (e as Error)?.message)
        return NextResponse.json({ kit: null })
    }
}

// POST — generate investor kit (runs agent, stores in DB)
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth()
        const { id } = await params

        const venture = await getVenture(id, session.userId)
        if (!venture) {
            return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
        }

        const ctx = venture.context as any
        if (!ctx?.research && !ctx?.feasibility) {
            return NextResponse.json(
                { error: 'At least research or feasibility must be completed before generating an investor kit' },
                { status: 400 }
            )
        }

        const project = venture.project_id ? await getProject(venture.project_id, session.userId) : null

        const ventureInput = {
            ventureId: venture.id,
            name: venture.name,
            globalIdea: project?.global_idea ?? undefined,
            context: venture.context as unknown as Record<string, unknown>,
        }

        // Run the agent synchronously (it's lightweight Flash model)
        let kitData: Record<string, unknown> | null = null

        await runInvestorKitAgent(
            ventureInput,
            async () => {}, // no streaming needed for this
            async (result) => {
                kitData = result as unknown as Record<string, unknown>
            }
        )

        if (!kitData) {
            return NextResponse.json({ error: 'Agent failed to produce output' }, { status: 500 })
        }

        const accessCode = generateAccessCode()
        const kit = await createInvestorKit(id, session.userId, accessCode, kitData)

        return NextResponse.json({ kit }, { status: 201 })
    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        const msg = (e as Error)?.message ?? ''
        console.error('Investor kit generation error:', msg)
        // Check if it's a missing table error
        if (msg.includes('investor_kits') || msg.includes('relation') || msg.includes('does not exist')) {
            return NextResponse.json(
                { error: 'Investor kit table not found — run migration 004_investor_kits.sql' },
                { status: 500 }
            )
        }
        return NextResponse.json({ error: 'Failed to generate investor kit' }, { status: 500 })
    }
}
