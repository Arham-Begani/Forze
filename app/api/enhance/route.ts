// app/api/enhance/route.ts
import { requireAuth, isAuthError } from '@/lib/auth'
import { getFlashModel } from '@/lib/gemini'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const EnhanceSchema = z.object({
  idea: z.string().min(5).max(2000),
})

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const result = EnhanceSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const model = getFlashModel()

    const chat = model.startChat({
      history: [],
      systemInstruction: {
        role: 'system',
        parts: [{
          text: `You are a startup idea enhancer for Forge, an AI venture orchestrator. Your job is to take a raw startup idea and enhance it into a clear, detailed, and compelling description that AI agents can work with effectively.

Rules:
- Keep the core idea intact — do NOT change what the user wants to build
- Add specificity: target audience, key problem, unique differentiator, monetization hint
- Make it actionable and concrete, not vague
- Keep it under 800 characters
- Write in second person ("Your platform..." or "A platform that...")
- Do NOT add bullet points or markdown — write a single flowing paragraph
- Sound confident and exciting but not hyperbolic
- Return ONLY the enhanced text, nothing else — no preamble, no quotes, no explanation`
        }],
      },
    })

    const response = await chat.sendMessage(
      `Enhance this startup idea for AI agents to process:\n\n"${result.data.idea}"`
    )

    const enhanced = response.response.text().trim()

    return NextResponse.json({ enhanced })
  } catch (e) {
    if (isAuthError(e)) return (e as any).toResponse()
    console.error('Enhance error:', e)
    return NextResponse.json({ error: 'Failed to enhance idea' }, { status: 500 })
  }
}
