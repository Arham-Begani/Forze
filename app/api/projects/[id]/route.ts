// app/api/projects/[id]/route.ts
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import {
  getProject,
  updateProject,
  deleteProject,
  getVenturesByProject,
} from '@/lib/queries'
import { getBillingSnapshot } from '@/lib/billing-queries'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const SourceDocumentSchema = z.object({
  name: z.string().max(255),
  content: z.string().max(50000), // ~50k chars per doc
  type: z.string().max(50),
})

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
  status: z.enum(['active', 'archived']).optional(),
  global_idea: z.string().optional(),
  source_documents: z.array(SourceDocumentSchema).max(5).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const project = await getProject(id, session.userId)
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const ventures = await getVenturesByProject(id)

    return NextResponse.json({ ...project, ventures })
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
    const project = await getProject(id, session.userId)
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const result = UpdateProjectSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input', details: result.error.flatten() }, { status: 400 })
    }

    // Gate source_documents to Builder+ plans
    if (result.data.source_documents && result.data.source_documents.length > 0) {
      const billing = await getBillingSnapshot(session.userId)
      const builderPlus = ['builder', 'pro', 'studio']
      if (!billing.hasUnlimitedAccess && !builderPlus.includes(billing.planSlug)) {
        return NextResponse.json(
          { error: 'Document upload is available on Builder, Pro, and Studio plans' },
          { status: 403 }
        )
      }
    }

    await updateProject(id, result.data)
    return NextResponse.json({ ...project, ...result.data })
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
    const project = await getProject(id, session.userId)
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await deleteProject(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
