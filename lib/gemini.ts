import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai'

export type { Content }

type SearchCapableModel = GenerativeModel | GrokResponsesModel

interface GrokResponsesModel {
    provider: 'grok'
    model: string
    tools?: Array<{ type: 'web_search' }>
    fallbackModel?: GenerativeModel
}

function getGeminiClient(): GoogleGenerativeAI {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set')
    }
    return new GoogleGenerativeAI(apiKey)
}

function hasGeminiApiKey(): boolean {
    return !!process.env.GEMINI_API_KEY
}

function hasXaiApiKey(): boolean {
    return !!process.env.XAI_API_KEY
}

function shouldUseGrokForSearch(): boolean {
    return hasXaiApiKey() && process.env.FORZE_USE_GROK_FOR_SEARCH !== 'false'
}

function createGeminiModel(config: Parameters<GoogleGenerativeAI['getGenerativeModel']>[0]): GenerativeModel {
    return getGeminiClient().getGenerativeModel(config)
}

function createGeminiSearchFallback(config: Parameters<GoogleGenerativeAI['getGenerativeModel']>[0]): GenerativeModel | undefined {
    if (!hasGeminiApiKey()) return undefined
    return createGeminiModel(config)
}

function createGrokSearchModel(
    modelEnvName: string,
    fallbackConfig: Parameters<GoogleGenerativeAI['getGenerativeModel']>[0]
): GrokResponsesModel {
    return {
        provider: 'grok',
        model: process.env[modelEnvName] ?? process.env.XAI_MODEL ?? 'grok-4',
        tools: [{ type: 'web_search' }],
        fallbackModel: createGeminiSearchFallback(fallbackConfig),
    }
}

function isGrokResponsesModel(model: SearchCapableModel): model is GrokResponsesModel {
    return typeof model === 'object' && model !== null && 'provider' in model && model.provider === 'grok'
}

function toPlainText(parts: Array<{ text?: string }> | undefined): string {
    return (parts ?? [])
        .map(part => part.text ?? '')
        .filter(Boolean)
        .join('\n')
        .trim()
}

function mapHistoryToGrokInput(systemPrompt: string, userMessage: string, history: Content[]) {
    const input: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
    ]

    for (const item of history) {
        const content = toPlainText(item.parts as Array<{ text?: string }>)
        if (!content) continue

        input.push({
            role: item.role === 'model' ? 'assistant' : 'user',
            content,
        })
    }

    input.push({ role: 'user', content: userMessage })
    return input
}

function extractGrokText(payload: any): string {
    if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text
    }

    const output = Array.isArray(payload?.output) ? payload.output : []
    const textParts: string[] = []

    for (const item of output) {
        if (!Array.isArray(item?.content)) continue
        for (const part of item.content) {
            if (typeof part?.text === 'string' && (part.type === 'output_text' || part.type === 'text')) {
                textParts.push(part.text)
            }
        }
    }

    return textParts.join('')
}

async function emitBufferedChunks(
    text: string,
    onChunk: (text: string) => Promise<void>,
    chunkSize = 128
): Promise<void> {
    for (let i = 0; i < text.length; i += chunkSize) {
        await onChunk(text.slice(i, i + chunkSize))
    }
}

async function streamGeminiPrompt(
    model: GenerativeModel,
    systemPrompt: string,
    userMessage: string,
    onChunk: (text: string) => Promise<void>,
    history: Content[] = []
): Promise<string> {
    const chat = model.startChat({
        history,
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
            if ((part as any).thought) {
                const thought = (part as any).thought
                const wrappedThought = `<think>${thought}</think>`
                fullText += wrappedThought

                if (!isThinking) {
                    await onChunk('\n[Shadow Board Thinking...]\n')
                    isThinking = true
                }
                continue
            }

            if (part.text) {
                if (isThinking) {
                    isThinking = false
                }

                fullText += part.text
                buffer += part.text

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

async function streamGrokPrompt(
    model: GrokResponsesModel,
    systemPrompt: string,
    userMessage: string,
    onChunk: (text: string) => Promise<void>,
    history: Content[] = []
): Promise<string> {
    const apiKey = process.env.XAI_API_KEY
    if (!apiKey) {
        throw new Error('XAI_API_KEY is not set')
    }

    const response = await fetch('https://api.x.ai/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model.model,
            store: false,
            input: mapHistoryToGrokInput(systemPrompt, userMessage, history),
            ...(model.tools ? { tools: model.tools } : {}),
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`xAI API call failed (${response.status}): ${errorText.slice(0, 400)}`)
    }

    const payload = await response.json()
    const fullText = extractGrokText(payload).trim()

    if (!fullText) {
        throw new Error('xAI API returned no text output')
    }

    await emitBufferedChunks(fullText, onChunk)
    return fullText
}

// Flash model - used by direct utility routes and creative agents that rely on Gemini's chat API.
export function getFlashModel(maxOutputTokens = 32768): GenerativeModel {
    return createGeminiModel({
        model: 'models/gemini-3-flash-preview',
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens,
        },
    })
}

// Search-backed model - prefers Grok when configured, with Gemini as a safe fallback.
export function getFlashModelWithSearch(): SearchCapableModel {
    if (shouldUseGrokForSearch()) {
        return createGrokSearchModel('XAI_RESEARCH_MODEL', {
            model: 'models/gemini-3-flash-preview',
            tools: [{ googleSearch: {} } as any],
            generationConfig: {
                temperature: 0.4,
                topP: 0.9,
                maxOutputTokens: 32768,
            },
        })
    }

    return createGeminiModel({
        model: 'models/gemini-3-flash-preview',
        tools: [{ googleSearch: {} } as any],
        generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            maxOutputTokens: 32768,
        },
    })
}

// Pro model with thinking - stays on Gemini because current direct callers depend on Gemini behavior.
export function getProModelWithThinking(
    thinkingBudget: number = 10000,
    modelId: string = 'models/gemini-3-pro-preview',
    maxOutputTokens: number = 32768
): GenerativeModel {
    return createGeminiModel({
        model: modelId,
        generationConfig: {
            temperature: 0.6,
            topP: 0.95,
            maxOutputTokens,
            // @ts-ignore
            thinkingConfig: { thinkingBudget },
        },
    })
}

// Search-backed deep analysis - prefers Grok when configured, with Gemini fallback.
export function getProModelWithSearchAndThinking(_thinkingBudget: number = 12000): SearchCapableModel {
    if (shouldUseGrokForSearch()) {
        return createGrokSearchModel('XAI_FEASIBILITY_MODEL', {
            model: 'models/gemini-3-pro-preview',
            tools: [{ googleSearch: {} } as any],
            generationConfig: {
                temperature: 0.5,
                topP: 0.95,
                maxOutputTokens: 32768,
                // @ts-ignore
                thinkingConfig: { thinkingBudget: _thinkingBudget },
            },
        })
    }

    return createGeminiModel({
        model: 'models/gemini-3-pro-preview',
        tools: [{ googleSearch: {} } as any],
        generationConfig: {
            temperature: 0.5,
            topP: 0.95,
            maxOutputTokens: 32768,
            // @ts-ignore
            thinkingConfig: { thinkingBudget: _thinkingBudget },
        },
    })
}

// Streams a prompt to a model, calling onChunk for each text delta.
// Returns the full accumulated text when done.
export async function streamPrompt(
    model: SearchCapableModel,
    systemPrompt: string,
    userMessage: string,
    onChunk: (text: string) => Promise<void>,
    history: Content[] = []
): Promise<string> {
    if (isGrokResponsesModel(model)) {
        try {
            return await streamGrokPrompt(model, systemPrompt, userMessage, onChunk, history)
        } catch (error) {
            if (!model.fallbackModel) {
                throw error
            }

            console.warn(
                'Grok search request failed, falling back to Gemini:',
                error instanceof Error ? error.message : String(error)
            )

            return await streamGeminiPrompt(model.fallbackModel, systemPrompt, userMessage, onChunk, history)
        }
    }

    return await streamGeminiPrompt(model, systemPrompt, userMessage, onChunk, history)
}

// JSON extraction
// Extracts the first valid JSON object from a string.
// Gemini often wraps JSON in markdown code fences - this strips them.
export function extractJSON(text: string): unknown {
    let cleaned = text
        .replace(/<(think|thought|thinking)>[\s\S]*?<\/(think|thought|thinking)>/gi, '')

    if (cleaned.includes('<think') || cleaned.includes('<thought')) {
        cleaned = cleaned.replace(/<(think|thought|thinking)>[\s\S]*/gi, '')
    }

    cleaned = cleaned
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

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Agent timed out after ${ms}ms`)), ms)
        ),
    ])
}

// Retries once on failure with a 3-second delay.
// Do NOT use this for Feasibility - Pro-style runs are expensive.
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
