// app/api/projects/route.ts
import { requireAuth, AuthError, isAuthError } from '@/lib/auth'
import { getProjectsByUser, createProject } from '@/lib/queries'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logError } from '@/lib/log'

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
})

export async function GET() {
  let step = 'init'
  try {
    step = 'auth'
    const session = await requireAuth()
    step = 'query'
    const projects = await getProjectsByUser(session.userId)
    return NextResponse.json(projects)
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    // Log full detail server-side; never return stack traces or raw error
    // messages to the client — they leak filesystem paths and internal schema.
    console.error(`[GET /api/projects] failed at step="${step}"`, e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()

    const result = CreateProjectSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input', details: result.error.flatten() }, { status: 400 })
    }

    const project = await createProject(
      session.userId,
      result.data.name,
      result.data.description,
      result.data.icon,
    )
    return NextResponse.json(project, { status: 201 })
  } catch (e) {
    if (isAuthError(e)) return e.toResponse()
    logError('projects', e, { msg: '[POST /api/projects]' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
