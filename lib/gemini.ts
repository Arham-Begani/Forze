import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai'
export type { Content }

// ── Clients ──────────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Flash model — used by Research, Branding, Marketing, Landing agents
export function getFlashModel(): GenerativeModel {
    return genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 16384,
        },
    })
}

// Flash model with Google Search grounding — used by Genesis (Research) only
export function getFlashModelWithSearch(): GenerativeModel {
    return genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        tools: [{ googleSearch: {} } as any],
        generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            maxOutputTokens: 16384,
        },
    })
}

// Pro model with thinking — used by Feasibility and Full Launch Architect
export function getProModelWithThinking(thinkingBudget: number = 10000, modelId: string = 'gemini-3-pro-preview'): GenerativeModel {
    return genAI.getGenerativeModel({
        model: modelId,
        generationConfig: {
            temperature: 0.6,
            topP: 0.95,
            maxOutputTokens: 32768,
            // @ts-ignore
            thinkingConfig: { includeThoughts: true, thinkingBudget },
        },
    })
}

// Pro model with thinking + Google Search — used by Feasibility for real-time data
export function getProModelWithSearchAndThinking(thinkingBudget: number = 12000): GenerativeModel {
    return genAI.getGenerativeModel({
        model: 'gemini-3-pro-preview',
        tools: [{ googleSearch: {} } as any],
        generationConfig: {
            temperature: 0.5,
            topP: 0.95,
            maxOutputTokens: 32768,
            // @ts-ignore
            thinkingConfig: { includeThoughts: true, thinkingBudget },
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
    onChunk: (text: string) => Promise<void>,
    history: Content[] = []
): Promise<string> {
    const chat = model.startChat({
        history: history,
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    })

    let result
    try {
        result = await chat.sendMessageStream(userMessage)
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        throw new Error(`Gemini API call failed: ${msg}`)
    }

    let fullText = ''
    let isThinking = false
    let buffer = ''

    for await (const chunk of result.stream) {
        let chunkText: string
        try {
            chunkText = chunk.text()
        } catch {
            continue // skip chunks that fail to extract text (e.g. safety filters)
        }
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
    // Strip think/thought tags and their content first.
    // If tags are not closed (truncated), we try to strip until the end of the thought if possible.
    let cleaned = text
        .replace(/<(think|thought|thinking)>[\s\S]*?<\/(think|thought|thinking)>/gi, '')

    // Handle case where <think> is opened but not closed
    if (cleaned.includes('<think') || cleaned.includes('<thought')) {
        cleaned = cleaned.replace(/<(think|thought|thinking)>[\s\S]*/gi, '')
    }

    cleaned = cleaned
        // Strip markdown code fences
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim()

    // Find first { and last }
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')

    if (start === -1 || end === -1) {
        throw new Error('No JSON object found in model output')
    }

    let jsonStr = cleaned.slice(start, end + 1)

    try {
        return JSON.parse(jsonStr)
    } catch (e) {
        // Try to fix common JSON issues (trailing commas, unescaped character, truncated)
        try {
            const fixed = jsonStr
                .replace(/,\s*([}\]])/g, '$1') // trailing commas
                // Fix unescaped backslashes that are not part of a valid escape sequence
                // Valid escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
                .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
                // Fix \u that is not followed by 4 hex digits
                .replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
                // Fix unescaped control characters (newlines inside strings are the most common)
                .replace(/[\x00-\x1F\x7F]/g, (c) => {
                    if (c === '\n') return '\\n'
                    if (c === '\t') return '\\t'
                    if (c === '\r') return '\\r'
                    return ''
                })
            
            return JSON.parse(fixed)
        } catch (e2) {
            // Check if it looks truncated (ends abruptly)
            if (!jsonStr.endsWith('}') && !jsonStr.endsWith(']')) {
                // Heuristic: try to close the last open quote and braces
                try {
                    let repaired = jsonStr.trim()
                    if (repaired.endsWith(',')) repaired = repaired.slice(0, -1)
                    
                    // Simple stack-based closer
                    let openBraces = 0
                    let openBrackets = 0
                    let inString = false
                    for (let i = 0; i < repaired.length; i++) {
                        if (repaired[i] === '"' && repaired[i-1] !== '\\') inString = !inString
                        if (!inString) {
                            if (repaired[i] === '{') openBraces++
                            if (repaired[i] === '}') openBraces--
                            if (repaired[i] === '[') openBrackets++
                            if (repaired[i] === ']') openBrackets--
                        }
                    }
                    if (inString) repaired += '"'
                    while (openBrackets > 0) { repaired += ']'; openBrackets-- }
                    while (openBraces > 0) { repaired += '}'; openBraces-- }
                    
                    return JSON.parse(repaired)
                } catch {
                    // fall back to original error
                }
            }
            throw new Error(`JSON parse failed: ${e}. Position mismatch or bad escapes. Length: ${jsonStr.length}`)
        }
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
export async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
    try {
        return await fn()
    } catch (e) {
        if (retries <= 0) throw e
        console.warn(`Agent attempt failed, retrying in 3s:`, e instanceof Error ? e.message : e)
        await new Promise(r => setTimeout(r, 3000))
        return await withRetry(fn, retries - 1)
    }
}
