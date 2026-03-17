import { GoogleGenerativeAI } from '@google/generative-ai'
import { getProModelWithThinking, streamPrompt, extractJSON } from './lib/gemini'

async function testShadowBoard() {
    const model = getProModelWithThinking(10000)
    const systemPrompt = `
# The Shadow Board
1. The Skeptic: Cynical.
2. The Evangelist: UX obsessed.
3. The Alchemist: Growth/Scale.

Your Task:
Simulate a debate. Be brutal.
Output EXACTLY this JSON:
{
  "survivalScore": number,
  "verdictLabel": "string",
  "boardDialogue": [ { "role": "string", "thought": "string", "brutalHonesty": "string" } ],
  "strategicPivots": [ { "currentPath": "string", "betterPath": "string", "rationale": "string" } ],
  "syntheticFeedback": [ { "persona": "string", "quote": "string", "sentiment": "positive" | "neutral" | "negative", "criticalFlaw": "string" } ]
}
Use <think> tags for internal debate before JSON.
`
    const userMessage = "Venture: 'Coffee for Cats'. It's an espresso bar for felines."
    
    console.log('--- STARTING RUN ---')
    let fullText = ''
    try {
        await streamPrompt(
            model,
            systemPrompt,
            userMessage,
            async (chunk) => {
                fullText += chunk
                process.stdout.write(chunk)
            }
        )
        console.log('\n--- STREAM COMPLETE ---')
        console.log('Full Text Length:', fullText.length)
        
        const raw = extractJSON(fullText)
        console.log('--- EXTRACTED JSON ---')
        console.log(JSON.stringify(raw, null, 2))
    } catch (e: any) {
        console.error('\n--- ERROR ---')
        console.error(e.message)
        console.log('Full Text recorded before error:', fullText)
    }
}

testShadowBoard()
