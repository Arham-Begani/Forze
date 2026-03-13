// app/api/debug/gemini/route.ts
// Diagnostic endpoint to test Gemini API connectivity
// DELETE THIS FILE after debugging is complete

import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function GET() {
    const results: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        hasApiKey: !!process.env.GEMINI_API_KEY,
        apiKeyPrefix: process.env.GEMINI_API_KEY?.slice(0, 8) + '...',
    }

    // Test 1: Flash model
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-flash-preview',
            generationConfig: { maxOutputTokens: 50 },
        })
        const chat = model.startChat({
            history: [],
            systemInstruction: { role: 'system', parts: [{ text: 'Reply with just "OK"' }] },
        })
        const res = await chat.sendMessage('ping')
        results.flashModel = { status: 'ok', response: res.response.text().slice(0, 50) }
    } catch (e) {
        results.flashModel = { status: 'error', message: e instanceof Error ? e.message : String(e) }
    }

    // Test 2: Flash model with Google Search
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-flash-preview',
            tools: [{ googleSearch: {} } as any],
            generationConfig: { maxOutputTokens: 50 },
        })
        const chat = model.startChat({
            history: [],
            systemInstruction: { role: 'system', parts: [{ text: 'Reply with just "OK"' }] },
        })
        const res = await chat.sendMessage('ping')
        results.flashWithSearch = { status: 'ok', response: res.response.text().slice(0, 50) }
    } catch (e) {
        results.flashWithSearch = { status: 'error', message: e instanceof Error ? e.message : String(e) }
    }

    // Test 3: Pro model
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-pro',
            generationConfig: { maxOutputTokens: 50 },
        })
        const chat = model.startChat({
            history: [],
            systemInstruction: { role: 'system', parts: [{ text: 'Reply with just "OK"' }] },
        })
        const res = await chat.sendMessage('ping')
        results.proModel = { status: 'ok', response: res.response.text().slice(0, 50) }
    } catch (e) {
        results.proModel = { status: 'error', message: e instanceof Error ? e.message : String(e) }
    }

    // Test 4: DB connectivity
    try {
        const { createDb } = await import('@/lib/db')
        const db = await createDb()
        const { count, error } = await db.from('ventures').select('*', { count: 'exact', head: true })
        results.database = { status: error ? 'error' : 'ok', count, error: error?.message }
    } catch (e) {
        results.database = { status: 'error', message: e instanceof Error ? e.message : String(e) }
    }

    return NextResponse.json(results, { status: 200 })
}
