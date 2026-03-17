import { GoogleGenerativeAI } from '@google/generative-ai'

const g = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

async function test(name: string) {
    try {
        const m = g.getGenerativeModel({ model: name })
        const r = await m.generateContent('say hi in 3 words')
        console.log(`✅ ${name}: ${r.response.text().trim().slice(0, 40)}`)
    } catch (e: any) {
        console.log(`❌ ${name}: ${e.status} ${e.statusText || e.message}`)
    }
}

async function main() {
    console.log('API Key present:', !!process.env.GEMINI_API_KEY)
    if (process.env.GEMINI_API_KEY) {
        console.log('API Key prefix:', process.env.GEMINI_API_KEY.slice(0, 8))
    }

    await test('models/gemini-1.5-flash')
    await test('models/gemini-1.5-pro')
    await test('models/gemini-2.0-flash')
    await test('models/gemini-2.0-flash-exp')
    await test('models/gemini-2.0-flash-thinking-exp')
    await test('models/gemini-2.0-pro-exp')
    await test('models/gemini-3-pro')
    await test('models/gemini-3-flash-preview')
}

main()
