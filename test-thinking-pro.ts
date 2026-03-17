import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

async function testThinking() {
    const modelId = 'gemini-3-pro-preview'
    console.log(`Testing ${modelId} with thinkingConfig...`)
    try {
        const model = genAI.getGenerativeModel({
            model: modelId,
            generationConfig: {
                // @ts-ignore
                thinkingConfig: { includeThoughts: true, thinkingBudget: 10000 },
            },
        })
        const result = await model.generateContent('Why is the sky blue?')
        console.log('✅ Success with thinkingConfig')
        // console.log(result.response.text())
    } catch (e: any) {
        console.log(`❌ Failed with thinkingConfig: ${e.message}`)
    }

    console.log(`\nTesting ${modelId} WITHOUT thinkingConfig but with <think> instruction...`)
    try {
        const model = genAI.getGenerativeModel({
            model: modelId,
        })
        const result = await model.generateContent('Use <think> tags to reason, then answer: Why is the sky blue?')
        console.log('✅ Success without thinkingConfig')
        console.log('Output starts with:', result.response.text().slice(0, 50))
    } catch (e: any) {
        console.log(`❌ Failed without thinkingConfig: ${e.message}`)
    }
}

testThinking()
