import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'

// ── Clients ──────────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Flash model — used by Research, Branding, Marketing, Landing agents
export function getFlashModel(): GenerativeModel {
    return genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 8192,
        },
    })
}

// Flash model with Google Search grounding — used by Genesis (Research) only
export function getFlashModelWithSearch(): GenerativeModel {
    return genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        tools: [{ googleSearch: {} } as any],
        generationConfig: {
            temperature: 0.4,   // lower temp for factual research
            topP: 0.9,
            maxOutputTokens: 8192,
        },
    })
}

// Pro model with thinking — used by Feasibility and Full Launch Architect
export function getProModelWithThinking(thinkingBudget: number = 8000, modelId: string = 'gemini-3-pro'): GenerativeModel {
    return genAI.getGenerativeModel({
        model: modelId,
        generationConfig: {
            temperature: 0.6,
            topP: 0.95,
            maxOutputTokens: 16384,
            // @ts-expect-error — thinkingConfig not yet in type definitions
            thinkingConfig: { thinkingBudget },
        },
    })
}

// ── Streaming helper ──────────────────────────────────────────────────────────

// Streams a prompt to a model, calling onChunk for each text delta.
// Returns the full accumulated text when done.
export async function streamPrompt(
    model: GenerativeModel,
    systemPrompt: string,
    userMessage: string,
    onChunk: (text: string) => Promise<void>
): Promise<string> {
    const chat = model.startChat({
        history: [],
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    })

    const result = await chat.sendMessageStream(userMessage)

    let fullText = ''
    let isThinking = false
    let buffer = ''

    for await (const chunk of result.stream) {
        const chunkText = chunk.text()
        if (!chunkText) continue

        fullText += chunkText
        buffer += chunkText

        while (buffer.length > 0) {
            if (isThinking) {
                const endMatch = buffer.match(/<\/(think|thought|thinking)>/i)
                if (endMatch) {
                    buffer = buffer.slice(endMatch.index! + endMatch[0].length)
                    isThinking = false
                } else {
                    const lastOpenTagPos = buffer.lastIndexOf('<')
                    if (lastOpenTagPos !== -1) {
                        buffer = buffer.slice(lastOpenTagPos)
                    } else {
                        buffer = ''
                    }
                    break
                }
            } else {
                const startMatch = buffer.match(/<(think|thought|thinking)>/i)
                if (startMatch) {
                    const textBefore = buffer.slice(0, startMatch.index)
                    if (textBefore) await onChunk(textBefore)
                    isThinking = true
                    buffer = buffer.slice(startMatch.index! + startMatch[0].length)
                } else {
                    const lastOpenBracket = buffer.lastIndexOf('<')
                    if (lastOpenBracket !== -1 && buffer.length - lastOpenBracket < 15) {
                        const textBefore = buffer.slice(0, lastOpenBracket)
                        if (textBefore) await onChunk(textBefore)
                        buffer = buffer.slice(lastOpenBracket)
                        break
                    } else {
                        await onChunk(buffer)
                        buffer = ''
                    }
                }
            }
        }
    }

    if (!isThinking && buffer.length > 0) {
        await onChunk(buffer)
    }

    return fullText
}

// ── JSON extraction ───────────────────────────────────────────────────────────

// Extracts the first valid JSON object from a string.
// Gemini often wraps JSON in markdown code fences — this strips them.
export function extractJSON(text: string): unknown {
    // Strip markdown code fences
    const stripped = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim()

    // Find first { and last }
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')

    if (start === -1 || end === -1) {
        throw new Error('No JSON object found in model output')
    }

    const jsonStr = stripped.slice(start, end + 1)

    try {
        return JSON.parse(jsonStr)
    } catch (e) {
        throw new Error(`JSON parse failed: ${e}. Raw text: ${jsonStr.slice(0, 200)}`)
    }
}

// ── Timeout wrapper ───────────────────────────────────────────────────────────

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Agent timed out after ${ms}ms`)), ms)
        ),
    ])
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────

// Retries once on failure with a 2-second delay.
// Do NOT use this for Feasibility — Pro thinking runs are expensive.
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn()
    } catch (e) {
        await new Promise(r => setTimeout(r, 2000))
        return await fn()
    }
}
