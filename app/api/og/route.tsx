import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const AGENTS = [
  { name: 'Genesis', color: '#C4975A' },
  { name: 'Research', color: '#5A8C6E' },
  { name: 'Identity', color: '#5A6E8C' },
  { name: 'Branding', color: '#5A6E8C' },
  { name: 'Landing Page', color: '#8C7A5A' },
  { name: 'Feasibility', color: '#7A5A8C' },
  { name: 'Shadow Board', color: '#8C5A7A' },
]

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#0d0d0c',
          display: 'flex',
          flexDirection: 'column',
          padding: '60px 72px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient glow top-left */}
        <div style={{
          position: 'absolute',
          top: '-120px',
          left: '-80px',
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(196,151,90,0.18) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Ambient glow bottom-right */}
        <div style={{
          position: 'absolute',
          bottom: '-100px',
          right: '-60px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(90,110,140,0.15) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Top: Logo + tagline badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              background: 'linear-gradient(135deg, #C4975A 0%, #D4924A 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}>
              ⚡
            </div>
            <span style={{
              fontSize: '28px',
              fontWeight: '900',
              color: '#faf9f6',
              letterSpacing: '-0.5px',
            }}>
              Forze
            </span>
          </div>

          <div style={{
            padding: '8px 18px',
            borderRadius: '999px',
            border: '1px solid rgba(196,151,90,0.4)',
            background: 'rgba(196,151,90,0.08)',
            fontSize: '13px',
            fontWeight: '600',
            color: '#C4975A',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#C4975A', display: 'flex' }} />
            Autonomous Venture Orchestrator
          </div>
        </div>

        {/* Main headline */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          gap: '16px',
        }}>
          <div style={{
            fontSize: '62px',
            fontWeight: '900',
            color: '#faf9f6',
            lineHeight: '1.1',
            letterSpacing: '-2px',
            maxWidth: '720px',
            display: 'flex',
            flexWrap: 'wrap',
          }}>
            Your idea →{' '}
            <span style={{ color: '#C4975A' }}>
              &nbsp;a full venture
            </span>
          </div>
          <div style={{
            fontSize: '22px',
            color: '#7a7268',
            maxWidth: '620px',
            lineHeight: '1.5',
            display: 'flex',
          }}>
            9 specialized AI agents run in parallel — research, brand, landing page, financials — all in under 5 minutes.
          </div>
        </div>

        {/* Agent pills */}
        <div style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {AGENTS.map((agent) => (
            <div
              key={agent.name}
              style={{
                padding: '7px 16px',
                borderRadius: '999px',
                border: `1px solid ${agent.color}55`,
                background: `${agent.color}12`,
                fontSize: '13px',
                fontWeight: '600',
                color: agent.color,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: agent.color, display: 'flex' }} />
              {agent.name}
            </div>
          ))}
          <div style={{
            padding: '7px 16px',
            borderRadius: '999px',
            border: '1px solid rgba(122,114,104,0.3)',
            fontSize: '13px',
            fontWeight: '600',
            color: '#7a7268',
            display: 'flex',
          }}>
            + more
          </div>
        </div>

        {/* Bottom accent line */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '3px',
          background: 'linear-gradient(90deg, transparent 0%, #C4975A 30%, #D4924A 50%, #C4975A 70%, transparent 100%)',
          display: 'flex',
        }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
