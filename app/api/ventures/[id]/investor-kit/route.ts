// app/api/ventures/[id]/investor-kit/route.ts
import { requireAuth, isAuthError } from '@/lib/auth'
import { getBillingSnapshot } from '@/lib/billing-queries'
import {
    getVenture,
    createInvestorKit,
    getInvestorKitByVenture,
    updateInvestorKit,
    getProject,
} from '@/lib/queries'
import { runInvestorKitAgent, InvestorKitSchema } from '@/agents/investor-kit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'

// Zod schema for PATCH — only the exact fields that can be manually edited
const InvestorKitPatchSchema = z.object({
    patch: z.object({
        executiveSummary: z.string().max(10000).optional(),
        pitchDeckOutline: z.array(z.object({
            slide: z.string().max(200),
            content: z.string().max(5000),
            speakerNotes: z.string().max(3000),
        })).max(20).optional(),
        onePageMemo: z.string().max(20000).optional(),
        askDetails: z.object({
            suggestedRaise: z.string().max(200).optional(),
            useOfFunds: z.array(z.string().max(200)).max(20).optional(),
            keyMilestones: z.array(z.string().max(500)).max(20).optional(),
        }).optional(),
        dataRoomSections: z.array(z.string().max(200)).max(30).optional(),
    }).refine(p => Object.keys(p).length > 0, { message: 'Patch must contain at least one field' }),
})

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

        const billing = await getBillingSnapshot(session.userId)

        const kit = await getInvestorKitByVenture(id)
        if (!kit) {
            return NextResponse.json({ kit: null })
        }

        return NextResponse.json({
            kit,
            meta: {
                has_manual_edits: kit.has_manual_edits ?? false,
                last_edited_at: kit.last_edited_at ?? null,
                source: kit.has_manual_edits ? 'manual' : 'ai',
            },
        })
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

        const billing = await getBillingSnapshot(session.userId)

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

        // Validate agent output before writing to DB
        const agentValidation = InvestorKitSchema.safeParse(kitData)
        if (!agentValidation.success) {
            console.error('Investor kit agent output failed schema validation:', agentValidation.error.flatten())
            return NextResponse.json({ error: 'Agent produced invalid output' }, { status: 500 })
        }
        kitData = agentValidation.data as unknown as Record<string, unknown>

        // ── AI/manual merge policy ──
        // If an existing kit has manual edits, preserve manually-edited fields
        const existingKit = await getInvestorKitByVenture(id)
        let mergeInfo: { preservedManualFields: string[]; updatedAIFields: string[] } | null = null

        if (existingKit?.has_manual_edits && existingKit.kit_data) {
            const old = existingKit.kit_data as Record<string, unknown>
            const topFields = ['executiveSummary', 'pitchDeckOutline', 'onePageMemo', 'askDetails', 'dataRoomSections']
            const preserved: string[] = []
            const updated: string[] = []

            // Compare each top-level field: if it differs from original AI output, it was manually edited — preserve it
            for (const field of topFields) {
                const oldVal = JSON.stringify(old[field] ?? '')
                const newVal = JSON.stringify((kitData as any)[field] ?? '')
                // Field was changed by user if old differs from what AI would have generated
                // Since we don't store original AI output separately, we treat any existing field
                // in a has_manual_edits kit as potentially edited — preserve it, let AI fill only missing
                if (old[field] !== undefined && old[field] !== null) {
                    // Preserve the manually-edited version
                    ;(kitData as any)[field] = old[field]
                    preserved.push(field)
                } else {
                    updated.push(field)
                }
            }

            mergeInfo = { preservedManualFields: preserved, updatedAIFields: updated }

            // Update existing kit with merged data instead of creating new
            const updatedKit = await updateInvestorKit(existingKit.id, session.userId, kitData)
            return NextResponse.json({
                kit: updatedKit,
                merge: mergeInfo,
            }, { status: 200 })
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

// PATCH — update specific fields of an existing investor kit (manual edits)
export async function PATCH(
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

        const kit = await getInvestorKitByVenture(id)
        if (!kit) {
            return NextResponse.json({ error: 'No investor kit found for this venture' }, { status: 404 })
        }

        const body = await request.json()
        const parsed = InvestorKitPatchSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid patch', details: parsed.error.flatten() }, { status: 400 })
        }

        const updated = await updateInvestorKit(kit.id, session.userId, parsed.data.patch as Record<string, unknown>)
        return NextResponse.json({ kit: updated })
    } catch (e) {
        if (isAuthError(e)) return (e as any).toResponse()
        console.error('Investor kit PATCH error:', (e as Error)?.message)
        return NextResponse.json({ error: 'Failed to update investor kit' }, { status: 500 })
    }
}
