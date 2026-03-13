import { requireAuth, isAuthError } from '@/lib/auth'
import { getFlashModel } from '@/lib/gemini'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const NameSchema = z.object({
  idea: z.string().min(5).max(2000),
})

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const result = NameSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const model = getFlashModel()

    const chat = model.startChat({
      history: [],
      systemInstruction: {
        role: 'system',
        parts: [{
          text: `You generate short, catchy project names from startup idea descriptions. Rules:
- Return ONLY the project name, nothing else — no quotes, no explanation, no preamble
- 2-4 words maximum
- Should capture the essence of the idea
- Professional and memorable, like a real startup name
- Do NOT use generic words like "App", "Platform", "Tool" alone
- Examples: "MealSync", "FarmTable Connect", "ContractFlow", "LinguaPair", "HealthPulse AI"
- Be creative but relevant to the idea`
        }],
      },
    })

    const response = await chat.sendMessage(
      `Generate a short project name for this startup idea:\n\n"${result.data.idea}"`
    )

    const name = response.response.text().trim().replace(/^["']|["']$/g, '')

    return NextResponse.json({ name })
  } catch (e) {
    if (isAuthError(e)) return (e as any).toResponse()
    console.error('Generate name error:', e)
    return NextResponse.json({ error: 'Failed to generate name' }, { status: 500 })
  }
}
