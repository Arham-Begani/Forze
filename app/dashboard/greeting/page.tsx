'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

export default function GreetingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  async function handleSubmit() {
    if (!idea.trim() || loading) return
    setLoading(true)

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ global_idea: idea.trim() }),
      })

      if (res.ok) {
        router.push(`/dashboard/project/${projectId}`)
      }
    } catch (err) {
      console.error('Failed to save idea:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  return (
    <div style={containerStyle} className="ambient-page">
      {/* Ambient background is handled by global .ambient-page ::before/::after */}
      
      <div style={contentStyle}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={headerWrap}
        >
          <div style={logoHex} />
          <h1 style={titleStyle}>Forge {projectName && <span style={projectAccent}>/ {projectName}</span>}</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: '100%', maxWidth: 720 }}
        >
          <div 
            className="glass-card"
            style={{
              ...inputCardStyle,
              borderColor: isFocused ? 'var(--accent-glow)' : 'var(--glass-border)',
              boxShadow: isFocused ? 'var(--shadow-premium), 0 0 0 1px var(--accent-glow)' : 'var(--shadow-lg)',
            }}
          >
            <textarea
              ref={textareaRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind? Describe your startup vision..."
              style={textareaStyle}
            />
            
            <div style={actionsBar}>
              <div style={leftActions}>
                <button style={iconBtnStyle} title="Attach context">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
              </div>
              
              <div style={rightActions}>
                <div style={modelSelector}>
                  <span style={modelText}>Forge v2</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
                
                <AnimatePresence>
                  {idea.length > 5 && (
                    <motion.button
                      initial={{ opacity: 0, x: 10, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 10, scale: 0.9 }}
                      onClick={handleSubmit}
                      disabled={loading}
                      style={submitBtnStyle}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {loading ? (
                        <div className="spinner" style={{ width: 16, height: 16 }} />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      )}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          
          <motion.p 
            style={hintStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 1 }}
          >
            Press <kbd style={kbdStyle}>⌘</kbd> + <kbd style={kbdStyle}>Enter</kbd> to initialize your vision.
          </motion.p>
        </motion.div>
      </div>
    </div>
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
}

const headerWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginBottom: '3rem',
  gap: '1rem',
}

const logoHex: React.CSSProperties = {
  width: 48,
  height: 48,
  background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
  boxShadow: '0 0 30px var(--accent-glow)',
}

const titleStyle: React.CSSProperties = {
  fontSize: '2.5rem',
  fontWeight: 800,
  letterSpacing: '-0.05em',
  color: 'var(--text)',
  margin: 0,
}

const projectAccent: React.CSSProperties = {
  color: 'var(--muted)',
  fontWeight: 500,
  fontSize: '1.8rem',
}

const inputCardStyle: React.CSSProperties = {
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  minHeight: '200px',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '120px',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--text)',
  fontSize: '1.2rem',
  lineHeight: '1.6',
  resize: 'none',
  fontFamily: 'inherit',
}

const actionsBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderTop: '1px solid var(--border)',
  paddingTop: '1rem',
}

const leftActions: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
}

const rightActions: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--muted)',
  cursor: 'pointer',
  padding: '0.5rem',
  borderRadius: '8px',
  transition: 'background 0.2s',
}

const modelSelector: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.4rem 0.8rem',
  borderRadius: '20px',
  background: 'var(--nav-active)',
  color: 'var(--text-soft)',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const modelText: React.CSSProperties = {
  opacity: 0.8,
}

const submitBtnStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  background: 'var(--accent)',
  border: 'none',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 12px var(--accent-glow)',
}

const hintStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  fontSize: '0.85rem',
  color: 'var(--muted)',
}

const kbdStyle: React.CSSProperties = {
  background: 'var(--nav-active)',
  padding: '2px 6px',
  borderRadius: '4px',
  border: '1px solid var(--border)',
  fontFamily: 'system-ui',
}
