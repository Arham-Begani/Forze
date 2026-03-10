import { runGenesisAgent } from './agents/genesis'

async function main() {
    console.log('🔬 Starting Genesis Agent test run...\n')
    console.log('─'.repeat(60))

    try {
        await runGenesisAgent(
            {
                ventureId: 'test-123',
                name: 'async video feedback tool for freelance UX designers',
                context: {},
            },
            async (chunk) => {
                process.stdout.write(chunk)
            },
            async (result) => {
                console.log('\n')
                console.log('─'.repeat(60))
                console.log('✅ GenesisOutput validated successfully!\n')
                console.log('Market summary:', result.marketSummary?.slice(0, 120), '...')
                console.log('TAM:', result.tam?.value, `(source: ${result.tam?.source?.slice(0, 60)})`)
                console.log('SAM:', result.sam?.value)
                console.log('SOM:', result.som?.value)
                console.log('Pain points found:', result.painPoints?.length)
                console.log('Competitors found:', result.competitors?.length)
                console.log('Risk matrix entries:', result.riskMatrix?.length)
                console.log('Top concepts:', result.topConcepts?.length)
                console.log('Recommended concept:', result.recommendedConcept)
                console.log('\nSWOT strengths:', result.swot?.strengths?.length)
                console.log('SWOT weaknesses:', result.swot?.weaknesses?.length)
                console.log('Competitor gap:', result.competitorGap?.slice(0, 120), '...')
            }
        )
    } catch (err) {
        console.error('\n❌ Test failed:', err)
        process.exit(1)
    }
}

main()
