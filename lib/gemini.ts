import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai'
export type { Content }

// ── Clients ──────────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Flash model — used by Research, Branding, Marketing, Landing agents
export function getFlashModel(): GenerativeModel {
    return genAI.getGenerativeModel({
        model: 'models/gemini-3-flash-preview',
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 32768,
        },
    })
}

// Flash model with Google Search grounding — used by Genesis (Research) only
export function getFlashModelWithSearch(): GenerativeModel {
    return genAI.getGenerativeModel({
        model: 'models/gemini-3-flash-preview',
        tools: [{ googleSearch: {} } as any],
        generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            maxOutputTokens: 32768,
        },
    })
}

// Pro model with thinking — used by Feasibility and Full Launch Architect
export function getProModelWithThinking(thinkingBudget: number = 10000, modelId: string = 'models/gemini-3-pro-preview'): GenerativeModel {
    return genAI.getGenerativeModel({
        model: modelId,
        generationConfig: {
            temperature: 0.6,
            topP: 0.95,
            maxOutputTokens: 32768,
            // @ts-ignore
            thinkingConfig: { thinkingBudget },
        },
    })
}

// Pro model with thinking + Google Search — used by Feasibility for real-time data
export function getProModelWithSearchAndThinking(thinkingBudget: number = 12000): GenerativeModel {
    return genAI.getGenerativeModel({
        model: 'models/gemini-3-pro-preview',
        tools: [{ googleSearch: {} } as any],
        generationConfig: {
            temperature: 0.5,
            topP: 0.95,
            maxOutputTokens: 32768,
            // @ts-ignore
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
        const parts = chunk.candidates?.[0]?.content?.parts || []
        
        for (const part of parts) {
            // Handle native thinking parts
            if ((part as any).thought) {
                const thought = (part as any).thought
                // Wrap in tags so we can easily search/strip later
                const wrappedThought = `<think>${thought}</think>`
                fullText += wrappedThought
                
                if (!isThinking) {
                    await onChunk('\n[Shadow Board Thinking...]\n')
                    isThinking = true
                }
                continue
            }

            // Handle text parts
            if (part.text) {
                if (isThinking) {
                    isThinking = false
                }

                const text = part.text
                fullText += text
                buffer += text

                // Stream in manageable chunks
                if (buffer.length > 5) {
                    await onChunk(buffer)
                    buffer = ''
                }
            }
        }
    }

    if (buffer.length > 0) {
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

    const parseCandidate = (jsonStr: string): unknown => {
        try {
            return JSON.parse(jsonStr)
        } catch (e) {
            try {
                const fixed = jsonStr
                    .replace(/,\s*([}\]])/g, '$1')
                    .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
                    .replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
                    .replace(/[\x00-\x1F\x7F]/g, (c) => {
                        if (c === '\n') return '\\n'
                        if (c === '\t') return '\\t'
                        if (c === '\r') return '\\r'
                        return ''
                    })

                return JSON.parse(fixed)
            } catch {
                if (!jsonStr.endsWith('}') && !jsonStr.endsWith(']')) {
                    try {
                        let repaired = jsonStr.trim()
                        if (repaired.endsWith(',')) repaired = repaired.slice(0, -1)

                        let openBraces = 0
                        let openBrackets = 0
                        let inString = false
                        for (let i = 0; i < repaired.length; i++) {
                            if (repaired[i] === '"' && repaired[i - 1] !== '\\') inString = !inString
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
                        // fall through to the outer error below
                    }
                }
                throw new Error(`JSON parse failed: ${e}. Length: ${jsonStr.length}`)
            }
        }
    }

    const candidateStarts: number[] = []
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') candidateStarts.push(i)
    }

    if (candidateStarts.length === 0) {
        throw new Error('No JSON object found in model output')
    }

    let lastError: Error | null = null

    for (const start of candidateStarts) {
        let depth = 0
        let inString = false
        let escaped = false

        for (let end = start; end < cleaned.length; end++) {
            const char = cleaned[end]

            if (inString) {
                if (escaped) {
                    escaped = false
                    continue
                }
                if (char === '\\') {
                    escaped = true
                    continue
                }
                if (char === '"') inString = false
                continue
            }

            if (char === '"') {
                inString = true
                continue
            }

            if (char === '{') {
                depth++
                continue
            }

            if (char === '}') {
                depth--
                if (depth === 0) {
                    const candidate = cleaned.slice(start, end + 1)
                    try {
                        return parseCandidate(candidate)
                    } catch (error) {
                        lastError = error instanceof Error ? error : new Error(String(error))
                    }
                }
            }
        }
    }

    throw lastError ?? new Error('No valid JSON object found in model output')
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
