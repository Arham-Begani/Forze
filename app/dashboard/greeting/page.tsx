'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { IdeaIntakeChat, type IdeaBriefValue } from '@/components/dashboard/IdeaIntakeChat'

// ─── Smart emoji picker ────────────────────────────────────────────────────���──
function pickEmojiForIdea(idea: string): string {
  const t = idea.toLowerCase()
  const rules: [string[], string][] = [
    // AI / ML
    [['artificial intelligence', 'machine learning', 'deep learning', 'llm', 'large language', 'neural network', 'gpt', 'generative ai', ' ai '], '🤖'],
    // Blockchain / crypto
    [['blockchain', 'crypto', 'bitcoin', 'ethereum', 'web3', 'nft', 'defi', 'token', 'wallet', 'dao'], '⛓️'],
    // Cybersecurity
    [['security', 'cybersecurity', 'encryption', 'privacy', 'firewall', 'authentication', 'zero-trust', 'compliance'], '🔒'],
    // Data / analytics
    [['analytics', 'data pipeline', 'business intelligence', 'dashboard', 'reporting', 'visualization', 'big data', 'data science'], '📊'],
    // Cloud / infra
    [['cloud', 'infrastructure', 'devops', 'kubernetes', 'serverless', 'microservices', 'hosting', 'deployment'], '☁️'],
    // Developer tools
    [['developer', 'developer tool', 'code', 'coding', 'api', 'sdk', 'open source', 'github', 'ci/cd', 'programming'], '💻'],
    // SaaS / platform (generic — keep late so specific categories win first)
    // Food / dining
    [['food', 'restaurant', 'meal', 'recipe', 'cooking', 'nutrition', 'chef', 'catering', 'grocery', 'dining', 'kitchen', 'menu', 'delivery food'], '🍕'],
    // Fitness / sports
    [['fitness', 'gym', 'workout', 'exercise', 'sport', 'athlete', 'training', 'running', 'cycling', 'triathlon'], '💪'],
    // Mental health / wellness
    [['mental health', 'mindfulness', 'meditation', 'stress', 'anxiety', 'therapy', 'counseling', 'burnout', 'wellbeing'], '🧠'],
    // Healthcare
    [['health', 'medical', 'doctor', 'hospital', 'patient', 'telemedicine', 'clinic', 'pharma', 'biotech', 'genomics', 'drug', 'diagnostic'], '🏥'],
    // Travel
    [['travel', 'flight', 'hotel', 'tourism', 'trip', 'vacation', 'itinerary', 'booking', 'backpacking', 'hostel'], '✈️'],
    // Fashion
    [['fashion', 'clothing', 'apparel', 'style', 'outfit', 'wardrobe', 'textile', 'garment', 'luxury fashion'], '👗'],
    // Beauty / cosmetics
    [['beauty', 'cosmetics', 'skincare', 'makeup', 'salon', 'spa', 'haircare', 'grooming product'], '💄'],
    // Pets
    [['pet', 'dog', 'cat', 'animal', 'veterinary', 'grooming', 'paw', 'shelter'], '🐾'],
    // Parenting / kids
    [['kids', 'children', 'parenting', 'baby', 'childcare', 'toddler', 'school-age', 'toy'], '👶'],
    // Gaming
    [['gaming', ' game', 'esports', 'video game', 'gamer', 'virtual reality', ' vr ', ' ar ', 'metaverse', 'augmented reality'], '🎮'],
    // Music
    [['music', 'audio', 'podcast', 'artist', 'band', 'concert', 'song', 'playlist', 'studio', 'streaming music'], '🎵'],
    // Video / film / content
    [['video', 'film', 'movie', 'content creator', 'youtube', 'tiktok', 'streaming', 'broadcast', 'media production'], '🎬'],
    // Photography / creative visuals
    [['photography', 'photo', 'camera', 'image editing', 'visual', 'stock photo'], '📷'],
    // Art / design
    [['art', 'illustration', 'graphic design', 'creative agency', 'motion design', 'ui/ux', 'product design'], '🎨'],
    // Finance / fintech
    [['finance', 'banking', 'investment', 'fintech', 'payment', 'lending', 'loan', 'insurance', 'wealth management', 'trading', 'stock', 'hedge', 'capital', 'micro-finance'], '💰'],
    // E-commerce / marketplace
    [['ecommerce', 'e-commerce', 'marketplace', 'retail', 'shopping', 'storefront', 'seller', 'buyer', 'online store', 'dropship'], '🛒'],
    // Real estate
    [['real estate', 'property', 'housing', 'rent', 'mortgage', 'home buying', 'apartment', 'landlord', 'proptech'], '🏠'],
    // Legal
    [['legal', 'law', 'attorney', 'contract', 'compliance', 'regulation', 'legaltech', 'lawyer', 'court'], '⚖️'],
    // HR / recruiting
    [['hiring', 'recruitment', 'talent', 'hr platform', 'jobs board', 'resume', 'workforce', 'employee', 'onboarding'], '👔'],
    // Education
    [['education', 'e-learning', 'course', 'tutoring', 'student', 'school', 'university', 'edtech', 'upskilling', 'certification'], '📚'],
    // Language / translation
    [['language', 'translation', 'linguistics', 'foreign language', 'multilingual', 'interpreter'], '🌐'],
    // Sustainability / green
    [['sustainability', 'environment', 'climate', 'carbon', 'renewable', 'clean energy', 'solar', 'eco-friendly', 'circular economy', 'net zero'], '🌱'],
    // Agriculture
    [['agriculture', 'farming', 'crop', 'agritech', 'farm management', 'harvest', 'irrigation', 'vertical farm'], '🌾'],
    // Logistics / delivery / supply chain
    [['logistics', 'delivery', 'supply chain', 'shipping', 'courier', 'last-mile', 'warehouse', 'fulfillment', 'trucking'], '📦'],
    // Automotive / mobility
    [['automotive', 'car', 'vehicle', 'ride-sharing', 'mobility', 'fleet', 'electric vehicle', ' ev ', 'autonomous vehicle', 'car rental'], '🚗'],
    // Space / aerospace
    [['space', 'satellite', 'aerospace', 'rocket', 'orbit', 'nasa', 'space tourism', 'launch vehicle'], '🚀'],
    // Science / research / biotech
    [['science', 'research', 'laboratory', 'biotech', 'genomics', 'drug discovery', 'clinical trial', 'lab automation'], '🔬'],
    // Social / community
    [['social network', 'community', 'forum', 'peer-to-peer', 'collaboration', 'co-working', 'online community'], '👥'],
    // Non-profit / impact
    [['nonprofit', 'charity', 'social impact', 'humanitarian', 'volunteering', 'donation', 'ngo', 'fundraising'], '❤️'],
    // Communication / messaging
    [['communication', 'messaging', 'chat', 'notification', 'crm', 'email marketing', 'sms'], '💬'],
    // News / media / content
    [['newsletter', 'blog', 'journalism', 'publishing', 'news aggregator', 'content marketing', 'media'], '📰'],
    // Productivity / workflow
    [['productivity', 'workflow', 'automation', 'task management', 'project management', 'efficiency', 'no-code', 'low-code'], '⚡'],
    // B2B / sales / CRM
    [['crm', 'sales tool', 'b2b', 'enterprise software', 'saas', 'revenue operations', 'lead generation', 'sales automation'], '📈'],
    // Events / ticketing
    [['event', 'ticketing', 'conference', 'webinar', 'festival', 'booking event', 'venue'], '🎟️'],
    // Smart home / IoT
    [['smart home', 'iot', 'internet of things', 'home automation', 'connected device', 'sensor', 'wearable'], '🏡'],
    // Construction / architecture
    [['construction', 'architecture', 'building', 'contractor', 'renovation', 'interior design', 'bim'], '🏗️'],
    // Sports tech
    [['sports analytics', 'fantasy sports', 'sports betting', 'athlete performance', 'sports management'], '⚽'],
  ]

  for (const [keywords, emoji] of rules) {
    if (keywords.some(kw => t.includes(kw))) return emoji
  }

  // Deterministic fallback based on text content
  const fallbacks = ['⚡', '💡', '🌟', '🔮', '🎯', '🌊', '🦋', '🔑', '💎', '🌈', '🏆', '🧩']
  const hash = idea.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return fallbacks[hash % fallbacks.length]
}


function GreetingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [idea, setIdea] = useState('')
  // 'seed' = typing the opening sentence; 'interview' = the intake chatbot is
  // asking follow-ups. The project already exists here, but global_idea is not
  // written until the founder confirms their brief.
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [projectName, setProjectName] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!projectId) {
      router.replace('/dashboard')
      return
    }

    async function loadProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (res.ok) {
          const data = await res.json()
          setProjectName(data.name)
          if (data.global_idea) {
            router.replace(`/dashboard/project/${projectId}`)
          }
        } else {
          router.replace('/dashboard')
        }
      } catch (err) {
        console.error('Failed to load project:', err)
      }
    }
    loadProject()
  }, [projectId, router])

  // Start the interview — no DB write yet.
  async function handleSubmit(brief: IdeaBriefValue, suggestedName: string | null) {
    if (loading) return
    const rawIdea = idea.trim()
    const finalIdea = brief.summary.trim() || rawIdea
    if (!finalIdea) return
    setLoading(true)

    try {
      const icon = pickEmojiForIdea(finalIdea)
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          global_idea: finalIdea,
          idea_brief: brief,
          icon,
          ...(suggestedName ? { name: suggestedName } : {}),
        }),
      })

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('Forze:project-updated', {
          detail: { projectId, global_idea: finalIdea, icon }
        }))

        // Use the name we just wrote, not the stale local copy.
        const effectiveName = suggestedName || projectName

        try {
          const ventureRes = await fetch('/api/ventures', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: effectiveName ? `${effectiveName} - v1` : 'Initial Venture', projectId }),
          })

          if (ventureRes.ok) {
            const newVenture = await ventureRes.json().catch(() => null)
            if (newVenture) window.dispatchEvent(new CustomEvent('Forze:venture-added', { detail: newVenture }))
          }
        } catch (err) {
          console.error('Failed to create initial venture:', err)
        }

        window.dispatchEvent(new CustomEvent('Forze:refresh-projects'))
        router.push(`/dashboard/project/${projectId}`)
        return
      }

      // PATCH failed — surface it instead of silently returning to the form.
      setSaveError('Could not save your idea. Please try again.')
    } catch (err) {
      console.error('Failed to save idea:', err)
      setSaveError('Could not save your idea. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return (
    <div className="ambient-page" style={containerStyle}>
      <div style={contentStyle}>
        <div style={headerWrap}>
          <div style={logoHex} />
          <div style={{ textAlign: 'center' }}>
            <h1 style={titleStyle}>Describe what you want to validate</h1>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="ambient-page" style={containerStyle}>
      <div style={contentStyle}>
        {/* Header with logo + project context */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={headerWrap}
        >
          <motion.div
            style={logoHex}
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          />
          <div style={{ textAlign: 'center' }}>
            <h1 style={titleStyle}>
              Describe what you want to validate
            </h1>
            {projectName && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 0.3 }}
                style={subtitleStyle}
              >
                for <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{projectName}</span>
              </motion.p>
            )}
          </div>
        </motion.div>

        <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <IdeaIntakeChat
            busy={loading}
            onComplete={handleSubmit}
            onSeedCaptured={setIdea}
          />
          {saveError && (
            <p style={{ fontSize: 12, color: '#e05252', textAlign: 'center', margin: 0 }}>{saveError}</p>
          )}
        </div>

        {/* Bottom features */}
        <motion.div
          style={featuresRow}
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.6 } }
          }}
        >
          {[
            { icon: '◎', label: 'Market Research', desc: 'Demand and competition' },
            { icon: '◇', label: 'Brand Identity', desc: 'Positioning that fits' },
            { icon: '▣', label: 'Landing Page', desc: 'Live validation page' },
            { icon: '◈', label: 'Feasibility', desc: 'GO/NO-GO verdict' },
          ].map(f => (
            <motion.div
              key={f.label}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0 }
              }}
              style={featureItem}
            >
              <span style={{ fontSize: 16, color: 'var(--accent)' }}>{f.icon}</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{f.label}</p>
                <p style={{ fontSize: 10, color: 'var(--muted)', margin: 0 }}>{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

export default function GreetingPage() {
  return (
    <Suspense fallback={
      <div className="ambient-page" style={containerStyle}>
        <div className="spinner-lg" />
      </div>
    }>
      <GreetingContent />
    </Suspense>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  background: 'var(--bg)',
}

const contentStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  zIndex: 1,
  gap: 0,
}

const headerWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginBottom: 36,
  gap: 16,
}

const logoHex: React.CSSProperties = {
  width: 44,
  height: 44,
  background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
  boxShadow: '0 0 30px var(--accent-glow)',
}

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: '-0.04em',
  color: 'var(--text)',
  margin: 0,
  lineHeight: 1.2,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--muted)',
  margin: '6px 0 0',
}

const inputCardStyle: React.CSSProperties = {
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  position: 'relative',
  overflow: 'hidden',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 120,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--text)',
  fontSize: 15,
  lineHeight: 1.7,
  resize: 'none',
  fontFamily: 'inherit',
}

const suggestionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: '0 0 8px',
}

const suggestionChipStyle: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 20,
  border: '1px solid var(--border)',
  background: 'var(--glass-bg)',
  color: 'var(--text-soft)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'border-color 200ms, background 200ms',
  textAlign: 'left',
}

const actionsBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderTop: '1px solid var(--border)',
  paddingTop: 12,
}

const submitBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 20px',
  borderRadius: 12,
  background: 'linear-gradient(135deg, var(--accent), #e8963a)',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 4px 14px var(--accent-glow)',
  transition: 'box-shadow 200ms',
}

const hintStyle: React.CSSProperties = {
  marginTop: 16,
  fontSize: 12,
  color: 'var(--muted)',
  textAlign: 'center',
}

const kbdStyle: React.CSSProperties = {
  background: 'var(--nav-active)',
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  fontFamily: 'system-ui',
  fontSize: 11,
}

const featuresRow: React.CSSProperties = {
  display: 'flex',
  gap: 24,
  marginTop: 48,
  flexWrap: 'wrap',
  justifyContent: 'center',
}

const featureItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 16px',
  borderRadius: 12,
  background: 'var(--glass-bg)',
  border: '1px solid var(--border)',
}
