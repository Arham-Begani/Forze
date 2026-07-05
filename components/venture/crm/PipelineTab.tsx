'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useToast } from '@/components/ui/Toast'
import {
  Badge,
  SectionHeader,
  StateCard,
  errorMessage,
  inputStyle,
  labelStyle,
  panelStyle,
  primaryButtonStyle,
  readJson,
  secondaryButtonStyle,
  toolbarStyle,
  type AsyncState,
  type CampaignSummary,
  type Deal,
  type EmailLead,
  type PipelineStage,
} from './shared'

export function PipelineTab({ ventureId, leads }: { ventureId: string; leads: EmailLead[] }) {
  const toast = useToast()
  const [stages, setStages] = useState<AsyncState<PipelineStage[]>>({ data: [], loading: true, error: null })
  const [deals, setDeals] = useState<AsyncState<Deal[]>>({ data: [], loading: true, error: null })
  const [activity, setActivity] = useState<AsyncState<CampaignSummary[]>>({ data: [], loading: true, error: null })
  const [activeDealId, setActiveDealId] = useState<string | null>(null)
  const [newStageName, setNewStageName] = useState('')
  const [addingStage, setAddingStage] = useState(false)
  const [showStageManager, setShowStageManager] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const leadsById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [stagesRes, dealsRes, activityRes] = await Promise.allSettled([
        fetch(`/api/ventures/${ventureId}/crm/pipeline-stages`),
        fetch(`/api/ventures/${ventureId}/crm/deals`),
        fetch(`/api/ventures/${ventureId}/crm/outreach-activity`),
      ])
      if (cancelled) return

      if (stagesRes.status === 'fulfilled' && stagesRes.value.ok) {
        const data = await readJson<{ stages?: PipelineStage[] }>(stagesRes.value)
        setStages({ data: data.stages ?? [], loading: false, error: null })
      } else {
        setStages({ data: [], loading: false, error: 'Failed to load pipeline stages' })
      }

      if (dealsRes.status === 'fulfilled' && dealsRes.value.ok) {
        const data = await readJson<{ deals?: Deal[] }>(dealsRes.value)
        setDeals({ data: data.deals ?? [], loading: false, error: null })
      } else {
        setDeals({ data: [], loading: false, error: 'Failed to load deals' })
      }

      if (activityRes.status === 'fulfilled' && activityRes.value.ok) {
        const data = await readJson<{ campaigns?: CampaignSummary[] }>(activityRes.value)
        setActivity({ data: data.campaigns ?? [], loading: false, error: null })
      } else {
        setActivity({ data: [], loading: false, error: 'Failed to load outreach activity' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [ventureId])

  async function moveDeal(dealId: string, stageId: string) {
    const prevDeals = deals.data
    setDeals((prev) => ({ ...prev, data: prev.data.map((d) => d.id === dealId ? { ...d, stage_id: stageId } : d) }))
    try {
      const res = await fetch(`/api/ventures/${ventureId}/crm/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      })
      const data = await readJson<{ success?: boolean; error?: unknown }>(res)
      if (!res.ok || !data.success) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to move deal')
    } catch (error) {
      setDeals({ data: prevDeals, loading: false, error: null })
      toast.error(errorMessage(error, 'Failed to move deal'))
    }
  }

  async function addStage() {
    const name = newStageName.trim()
    if (!name) return
    setAddingStage(true)
    try {
      const res = await fetch(`/api/ventures/${ventureId}/crm/pipeline-stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, position: stages.data.length }),
      })
      const data = await readJson<{ success?: boolean; stage?: PipelineStage; error?: unknown }>(res)
      if (!res.ok || !data.success || !data.stage) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to add stage')
      setStages((prev) => ({ ...prev, data: [...prev.data, data.stage!] }))
      setNewStageName('')
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to add stage'))
    } finally {
      setAddingStage(false)
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDealId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDealId(null)
    const { active, over } = event
    if (!over) return
    const dealId = String(active.id)
    const stageId = String(over.id)
    const deal = deals.data.find((d) => d.id === dealId)
    if (deal && deal.stage_id !== stageId) {
      moveDeal(dealId, stageId)
    }
  }

  const activeDeal = activeDealId ? deals.data.find((d) => d.id === activeDealId) ?? null : null

  if (stages.loading || deals.loading) return <StateCard title="Loading pipeline..." />
  if (stages.error) return <StateCard title="Failed to load pipeline" detail={stages.error} tone="error" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section style={panelStyle}>
        <div style={toolbarStyle}>
          <SectionHeader title="Pipeline" detail={`${deals.data.length.toLocaleString()} deals across ${stages.data.length} stages. Drag a card to change its stage.`} />
          <button type="button" onClick={() => setShowStageManager((v) => !v)} style={secondaryButtonStyle}>
            {showStageManager ? 'Done' : 'Manage stages'}
          </button>
        </div>

        {showStageManager && (
          <div style={stageManagerStyle}>
            <label style={labelStyle}>
              New stage name
              <input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} style={inputStyle} placeholder="e.g. Negotiation" />
            </label>
            <button type="button" onClick={addStage} disabled={addingStage || !newStageName.trim()} style={primaryButtonStyle(addingStage || !newStageName.trim())}>
              {addingStage ? 'Adding...' : 'Add stage'}
            </button>
          </div>
        )}

        {stages.data.length === 0 ? (
          <StateCard title="No stages configured" detail="Stages will be seeded automatically." />
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div style={boardStyle}>
              {stages.data.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  deals={deals.data.filter((d) => d.stage_id === stage.id)}
                  leadsById={leadsById}
                />
              ))}
            </div>
            <DragOverlay>
              {activeDeal ? <DealCardView deal={activeDeal} lead={leadsById.get(activeDeal.lead_id)} dragging /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </section>

      <OutreachActivityPanel activity={activity} />
    </div>
  )
}

function StageColumn({
  stage,
  deals,
  leadsById,
}: {
  stage: PipelineStage
  deals: Deal[]
  leadsById: Map<string, EmailLead>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const total = deals.reduce((sum, d) => sum + (d.value ?? 0), 0)

  return (
    <div ref={setNodeRef} style={{ ...columnStyle, background: isOver ? 'var(--accent-soft)' : 'var(--sidebar)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {stage.is_won && <Badge color="#16a34a">Won</Badge>}
          {stage.is_lost && <Badge color="#dc2626">Lost</Badge>}
          <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)' }}>{stage.name}</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{deals.length}</span>
      </div>
      {total > 0 && (
        <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800, marginBottom: 10 }}>
          ${total.toLocaleString()}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
        {deals.map((deal) => (
          <DraggableDealCard key={deal.id} deal={deal} lead={leadsById.get(deal.lead_id)} />
        ))}
      </div>
    </div>
  )
}

function DraggableDealCard({ deal, lead }: { deal: Deal; lead?: EmailLead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id })
  const style: CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <DealCardView deal={deal} lead={lead} />
    </div>
  )
}

function DealCardView({ deal, lead, dragging = false }: { deal: Deal; lead?: EmailLead; dragging?: boolean }) {
  return (
    <div style={{ ...dealCardStyle, cursor: dragging ? 'grabbing' : 'grab', boxShadow: dragging ? '0 12px 32px rgba(0,0,0,0.18)' : dealCardStyle.boxShadow }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{deal.title}</div>
      {lead && <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{lead.name || lead.email || lead.external_identity}</div>}
      {deal.value != null && <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800, marginTop: 4 }}>${deal.value.toLocaleString()}</div>}
    </div>
  )
}

// Phase 4: read-only, clearly-attributed merge of CRM-native outreach_campaigns
// and the separate Campaigns/Auto-GTM system — no data-model convergence.
function OutreachActivityPanel({ activity }: { activity: AsyncState<CampaignSummary[]> }) {
  return (
    <section style={panelStyle}>
      <SectionHeader title="Outreach activity" detail="Combined view of CRM sends and Campaigns sends — the two systems don't share data yet, so this merges both for one honest picture." />
      {activity.loading && <StateCard title="Loading outreach activity..." />}
      {activity.error && <StateCard title="Failed to load outreach activity" detail={activity.error} tone="error" />}
      {!activity.loading && !activity.error && activity.data.length === 0 && (
        <StateCard title="No outreach sent yet" detail="Sends from the Outreach tab or Campaigns will appear here." />
      )}
      {activity.data.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {activity.data.map((campaign) => (
            <div key={`${campaign.origin}:${campaign.id}`} style={activityRowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge color={campaign.origin === 'crm' ? '#5A6E8C' : '#8C5A7A'}>{campaign.origin === 'crm' ? 'CRM' : 'Campaigns'}</Badge>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{campaign.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-soft)' }}>
                <span>{(campaign.sent_count ?? 0).toLocaleString()} sent</span>
                <span>{(campaign.opened_count ?? 0).toLocaleString()} opened</span>
                <span>{(campaign.replied_count ?? 0).toLocaleString()} replied</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const boardStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  overflowX: 'auto',
  paddingBottom: 8,
}

const columnStyle: CSSProperties = {
  minWidth: 220,
  width: 220,
  flexShrink: 0,
  borderRadius: 14,
  border: '1px solid var(--border)',
  padding: 12,
  transition: 'background 150ms',
}

const dealCardStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--card-solid)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
}

const stageManagerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 10,
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
  marginBottom: 14,
}

const activityRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
  flexWrap: 'wrap',
}
