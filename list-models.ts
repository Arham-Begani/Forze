import { GoogleGenerativeAI } from '@google/generative-ai'


const g = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

async function main() {
    try {
        // @ts-ignore
        const models = await g.listModels()
        console.log('Available models:')
        for (const m of models.models) {
            console.log(`- ${m.name}`)
        }
    } catch (e: any) {
        console.log('Error listing models:', e.message)
    }
}

main()
