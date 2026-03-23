import { runGenesisAgent, GenesisOutput } from './genesis'
import { runIdentityAgent, IdentityOutput } from './identity'
import { runPipelineAgent, PipelineOutput } from './pipeline'
import { runFeasibilityAgent, FeasibilityOutput } from './feasibility'
import { runContentAgent, ContentOutput } from './content'
import { getProModelWithThinking, streamPrompt, withTimeout, withRetry, Content } from '../lib/gemini'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FullLaunchResult {
  research: GenesisOutput
  branding: IdentityOutput
  marketing: ContentOutput
  landing: PipelineOutput
  feasibility: FeasibilityOutput
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function runFullLaunch(
  venture: { ventureId: string; name: string; globalIdea?: string; context: Record<string, unknown> },
  onStream: (line: string) => Promise<void>,
  onAgentStatus: (agentId: string, status: 'waiting' | 'running' | 'complete' | 'failed') => Promise<void>,
  onComplete: (result: FullLaunchResult) => Promise<void>,
  depth: 'brief' | 'medium' | 'detailed' = 'medium',
  history: Content[] = []
): Promise<void> {

  // ── STEP 0 — Architect thinks ──────────────────────────────────────────────

  await onStream('=== Architect Agent: Planning your venture ===\n\n')

  const architectModel = getProModelWithThinking(5000, 'models/gemini-3-pro-preview')

  const architectRun = async () => {
    return await streamPrompt(
      architectModel,
      `You are the Architect Agent — team lead for the Forze venture platform.
       Your job is to analyse a venture concept and produce a brief task plan
       for your five specialist agents: Genesis, Identity, Content Factory, Pipeline, Feasibility.
       Be specific. Reference the venture concept in each agent brief.
       Output a short task plan (under 300 words) then stop.

       IMPORTANT: Do not output any conversational text or "Thought Process" headers. Any step-by-step reasoning or thought process MUST be strictly wrapped inside <think> and </think> tags. Only the final output should be outside the <think> tags.`,
      `Venture concept: ${venture.name}
${venture.globalIdea ? `Global Startup Vision: ${venture.globalIdea}\n` : ''}
       Briefly plan what each agent should focus on for this specific venture.
       Be concrete and specific to this idea — not generic instructions.`,
      onStream,
      history
    )
  }

  let architectPlanText = ''
  try {
    architectPlanText = await withRetry(() => withTimeout(architectRun(), 90_000))
  } catch (architectErr) {
    const msg = architectErr instanceof Error ? architectErr.message : String(architectErr)
    await onStream(`[Architect step skipped — ${msg}]\n\n`)
    architectPlanText = `Proceed with full analysis of: ${venture.name}`
  }

  await onStream('\n\n')
  venture = { ...venture, context: { ...venture.context, architectPlan: architectPlanText } }

  // ── STEP 1 — Genesis Engine ────────────────────────────────────────────────

  await onAgentStatus('research', 'running')
  await onStream('=== Genesis Engine: Market Research ===\n\n')

  let genesisResult: GenesisOutput | null = null

  await runGenesisAgent(venture, onStream, async (result) => {
    genesisResult = result
    venture = { ...venture, context: { ...venture.context, research: result } }
  }, depth, history)

  if (!genesisResult) throw new Error('Genesis agent failed to produce output')
  await onAgentStatus('research', 'complete')
  await onStream('\n\n')

  // ── STEP 2 — Identity Architect (requires Genesis) ─────────────────────────

  await onAgentStatus('branding', 'running')
  await onStream('=== Identity Architect: Brand Bible ===\n\n')

  let identityResult: IdentityOutput | null = null

  await runIdentityAgent(venture, onStream, async (result) => {
    identityResult = result
    venture = { ...venture, context: { ...venture.context, branding: result } }
  }, history)

  if (!identityResult) throw new Error('Identity agent failed to produce output')
  await onAgentStatus('branding', 'complete')
  await onStream('\n\n')

  // ── STEP 2.5 — Content Factory (requires Branding) ──────────────────────────

  await onAgentStatus('marketing', 'running')
  await onStream('=== Content Factory: Marketing Strategy ===\n\n')

  let marketingResult: ContentOutput | null = null

  try {
    await runContentAgent(venture, onStream, async (result) => {
      marketingResult = result
      venture = { ...venture, context: { ...venture.context, marketing: result } }
    }, history)

    if (!marketingResult) throw new Error('Marketing agent produced no output')
    await onAgentStatus('marketing', 'complete')
  } catch (marketingErr) {
    await onAgentStatus('marketing', 'failed')
    await onStream('\n[Content Factory failed: ' + (marketingErr instanceof Error ? marketingErr.message : String(marketingErr)) + ']\n')
  }
  await onStream('\n\n')

  // --- STEP 3 — Pipeline + Feasibility in PARALLEL ---------------------------

  await onAgentStatus('landing', 'running')
  await onAgentStatus('feasibility', 'running')
  await onStream('=== Finalizing Production Pipeline & Strategic Validation ===\n\n')

  // Pass ALL context to both agents: Genesis, Identity, AND Marketing
  const enrichedVenture = { 
    ...venture, 
    context: { 
      ...venture.context, 
      research: genesisResult,
      branding: identityResult,
      marketing: marketingResult
    } 
  }

  const [landingSettled, feasibilitySettled] = await Promise.allSettled([
    new Promise<PipelineOutput>((resolve, reject) => {
      runPipelineAgent(
        enrichedVenture,
        async (chunk) => onStream('[Landing] ' + chunk),
        async (result) => resolve(result),
        history
      ).catch(reject)
    }),
    new Promise<FeasibilityOutput>((resolve, reject) => {
      runFeasibilityAgent(
        enrichedVenture,
        async (chunk) => onStream('[Feasibility] ' + chunk),
        async (result) => resolve(result),
        depth,
        history
      ).catch(reject)
    }),
  ])

  let landingResult: PipelineOutput | null = null
  let feasibilityResult: FeasibilityOutput | null = null

  if (landingSettled.status === 'fulfilled') {
    landingResult = landingSettled.value
    await onAgentStatus('landing', 'complete')
  } else {
    await onAgentStatus('landing', 'failed')
    await onStream('\n[Landing Page failed: ' + (landingSettled.reason as Error)?.message + ']\n')
  }

  if (feasibilitySettled.status === 'fulfilled') {
    feasibilityResult = feasibilitySettled.value
    await onAgentStatus('feasibility', 'complete')
  } else {
    await onAgentStatus('feasibility', 'failed')
    await onStream('\n[Feasibility failed: ' + (feasibilitySettled.reason as Error)?.message + ']\n')
  }

  // Require at minimum Research + Branding to succeed
  if (!genesisResult || !identityResult) {
    throw new Error('Full Launch failed: Research or Branding did not complete.')
  }

  await onComplete({
    research: genesisResult,
    branding: identityResult,
    marketing: (marketingResult ?? {}) as ContentOutput,
    landing: (landingResult ?? {}) as PipelineOutput,
    feasibility: (feasibilityResult ?? {}) as FeasibilityOutput,
  })
}
