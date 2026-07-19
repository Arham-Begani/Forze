'use client'

// Landing module preview surface: builds the sandboxed preview document and
// renders the device-framed panel around it.
//
// Split out of page.tsx — it's the single largest self-contained cluster there
// and touches none of the page's state, only its own props. page.tsx uses two
// symbols from here (the panel and the site-URL helper); the HTML-building
// internals stay private so the escaping logic has exactly one caller.

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { stripGeneratedCodeFences, LANDING_RUNTIME_SHIM } from '@/lib/landing-page'

// ─── Landing Preview Panel ───────────────────────────────────────────────────

// Build the public URL for a venture's published landing page.
// Prefers the subdomain form (https://<subdomain>.<host>) using
// NEXT_PUBLIC_APP_URL as the base; falls back to the legacy /v/[id] path.
export function buildVentureSiteUrl(subdomain: string | null, ventureId: string): string {
  if (!subdomain) return `/v/${ventureId}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  try {
    const url = new URL(appUrl)
    const host = url.host.startsWith('www.') ? url.host.slice(4) : url.host
    return `${url.protocol}//${subdomain}.${host}`
  } catch {
    return `/v/${ventureId}`
  }
}

function escapeHtmlForPreview(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildPreviewHtml(
  componentCode: string,
  seo: { title?: string; description?: string; keywords?: string[] },
  ventureName: string
): string {
  const isReactComponent =
    componentCode.includes('export default') ||
    componentCode.includes('function ') ||
    componentCode.includes('const ') ||
    componentCode.includes('useState') ||
    componentCode.includes('React')

  if (isReactComponent) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtmlForPreview(seo.title || ventureName || 'Landing Page')}</title>
  ${seo.description ? `<meta name="description" content="${escapeHtmlForPreview(seo.description)}" />` : ''}
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  ${LANDING_RUNTIME_SHIM}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    html { scroll-behavior: smooth; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer, useLayoutEffect, useId, useTransition, useDeferredValue, Fragment, Children, cloneElement, createContext, useContext, forwardRef, memo } = React;

    ${componentCode
      .replace(/^import\s+.*$/gm, '// import removed for preview')
      .replace(/export\s+default\s+/g, 'const __LandingPage__ = ')}

    const App = typeof __LandingPage__ !== 'undefined'
      ? __LandingPage__
      : typeof LandingPage !== 'undefined'
        ? LandingPage
        : typeof HomePage !== 'undefined'
          ? HomePage
          : typeof Page !== 'undefined'
            ? Page
            : () => React.createElement('div', {style:{padding:40,textAlign:'center',color:'#888'}}, 'Component not found');

    const __Boundary__ = (typeof window !== 'undefined' && typeof window.__ForzeErrorBoundary__ === 'function') ? window.__ForzeErrorBoundary__ : null;
    const __rootElement__ = __Boundary__ ? React.createElement(__Boundary__, null, React.createElement(App)) : React.createElement(App);
    ReactDOM.createRoot(document.getElementById('root')).render(__rootElement__);
  <\/script>
</body>
</html>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtmlForPreview(seo.title || ventureName || 'Landing Page')}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  </style>
</head>
<body>
  ${componentCode}
</body>
</html>`
}

type LandingPreviewError = {
  kind: 'react' | 'script' | 'promise' | 'unknown'
  message: string
  stack?: string
  componentStack?: string
  filename?: string
  lineno?: number
  colno?: number
  capturedAt: number
}

export function LandingPreviewPanel({ componentCode, result, ventureName, accent, device, showCode, onDeviceChange, onToggleCode, onClose, ventureId, ventureSubdomain }: {
  componentCode: string
  result: Record<string, any>
  ventureName: string
  accent: string
  device: 'desktop' | 'tablet' | 'mobile'
  showCode: boolean
  onDeviceChange: (d: 'desktop' | 'tablet' | 'mobile') => void
  onToggleCode: () => void
  onClose: () => void
  ventureId: string
  ventureSubdomain: string | null
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [iframeKey, setIframeKey] = useState(0)
  const [previewError, setPreviewError] = useState<LandingPreviewError | null>(null)
  const [showErrorDetails, setShowErrorDetails] = useState(false)
  const [fixPromptCopied, setFixPromptCopied] = useState(false)

  const clean = stripGeneratedCodeFences(componentCode)

  const seo = result.landing?.seoMetadata || result.seoMetadata || {}
  const previewHtml = buildPreviewHtml(clean, seo, ventureName)

  useEffect(() => {
    if (iframeRef.current) {
      setIframeLoading(true)
      iframeRef.current.srcdoc = previewHtml
    }
    // A new render of the iframe is a fresh chance — clear any prior error.
    setPreviewError(null)
    setShowErrorDetails(false)
    setFixPromptCopied(false)
  }, [previewHtml, iframeKey])

  // Listen for forze:landing-error messages from the iframe. The runtime
  // shim sends these for both React render errors (via the boundary's
  // componentDidCatch) and uncaught script / promise errors.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event?.data
      if (!data || typeof data !== 'object' || data.type !== 'forze:landing-error') return
      // Only accept messages from our iframe's content window.
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return
      setPreviewError({
        kind: (data.kind === 'react' || data.kind === 'script' || data.kind === 'promise') ? data.kind : 'unknown',
        message: typeof data.message === 'string' ? data.message : 'Component error',
        stack: typeof data.stack === 'string' ? data.stack : undefined,
        componentStack: typeof data.componentStack === 'string' ? data.componentStack : undefined,
        filename: typeof data.filename === 'string' ? data.filename : undefined,
        lineno: typeof data.lineno === 'number' ? data.lineno : undefined,
        colno: typeof data.colno === 'number' ? data.colno : undefined,
        capturedAt: Date.now(),
      })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Build a one-paragraph prompt the founder can paste into the edit input
  // to ask the agent to fix exactly what crashed.
  function buildFixPrompt(err: LandingPreviewError): string {
    const lines: string[] = []
    lines.push(`The landing page is crashing with this error: "${err.message}".`)
    if (err.filename || typeof err.lineno === 'number') {
      lines.push(`Source: ${err.filename || 'inline script'}${typeof err.lineno === 'number' ? `:${err.lineno}` : ''}`)
    }
    // Heuristic hints — call out the most common drift patterns.
    const msg = err.message.toLowerCase()
    if (msg.includes('lucide') || /\bShield\b|\bChevron|\bArrow|\bCheck\b|\bUser\b|\bMail\b|\bStar\b/.test(err.message)) {
      lines.push('This usually means the component references an icon library (lucide-react, Heroicons, etc.) that is not loaded. Replace every icon reference with an inline <svg> or emoji.')
    } else if (msg.includes('motion') || msg.includes('animatepresence')) {
      lines.push('This looks like a framer-motion reference. Replace motion.* with plain HTML tags and use Tailwind transitions for animation.')
    } else if (msg.includes('next/') || msg.includes('use router') || msg.includes('useRouter')) {
      lines.push('This references Next.js modules. Replace next/image with <img>, next/link with <a>, and remove useRouter.')
    } else if (msg.includes('process.env')) {
      lines.push('There is no Node environment in the preview iframe. Inline any process.env values or remove the references.')
    } else {
      lines.push('Identify the undefined reference and replace it with a safe equivalent (emoji, inline SVG, or plain Tailwind classes).')
    }
    lines.push('Output the COMPLETE updated fullComponent so the page renders without errors.')
    return lines.join(' ')
  }

  async function handleCopyFixPrompt() {
    if (!previewError) return
    const prompt = buildFixPrompt(previewError)
    try {
      await navigator.clipboard.writeText(prompt)
      setFixPromptCopied(true)
      window.setTimeout(() => setFixPromptCopied(false), 2200)
    } catch {
      // Clipboard blocked (e.g. iframe permissions) — fall back to a prompt-style alert.
      try { window.prompt('Copy this fix prompt into the edit input:', prompt) } catch {}
    }
  }

  const deviceWidths: Record<string, string> = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
  }

  const deviceIcons: Record<string, React.ReactNode> = {
    desktop: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
      </svg>
    ),
    tablet: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="20" x="4" y="2" rx="2" /><line x1="12" x2="12.01" y1="18" y2="18" />
      </svg>
    ),
    mobile: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="12" height="20" x="6" y="2" rx="2" /><line x1="12" x2="12.01" y1="18" y2="18" />
      </svg>
    ),
  }

  const toolBtnStyle = (active: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: active ? `${accent}18` : 'transparent',
    color: active ? accent : 'var(--muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  })

  const actionBtnSmall: React.CSSProperties = {
    height: 28,
    padding: '0 10px',
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-soft)',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 600,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    transition: 'all 0.2s',
    letterSpacing: '0.02em',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="landing-preview-panel"
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sidebar)',
        borderLeft: '1px solid var(--border)',
        height: '100%',
      }}
    >
      {/* ── Toolbar ── */}
      <div style={{
        padding: '0 12px',
        height: 44,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.02)',
        gap: 8,
      }}>
        {/* Left — device toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            background: 'var(--glass-bg)',
            borderRadius: 8,
            padding: 2,
            border: '1px solid var(--border)',
          }}>
            {(['desktop', 'tablet', 'mobile'] as const).map(d => (
              <motion.button
                key={d}
                onClick={() => onDeviceChange(d)}
                style={toolBtnStyle(device === d)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                title={d.charAt(0).toUpperCase() + d.slice(1)}
              >
                {deviceIcons[d]}
              </motion.button>
            ))}
          </div>
          <span style={{
            fontSize: 9,
            color: 'var(--muted)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginLeft: 6,
            opacity: 0.6,
          }}>
            {device === 'desktop' ? 'Full' : device === 'tablet' ? '768px' : '375px'}
          </span>
        </div>

        {/* Right — actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Refresh */}
          <motion.button
            onClick={() => setIframeKey(k => k + 1)}
            style={actionBtnSmall}
            whileHover={{ scale: 1.04, borderColor: accent }}
            whileTap={{ scale: 0.96 }}
            title="Refresh preview"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </motion.button>

          {/* Code toggle */}
          <motion.button
            onClick={onToggleCode}
            style={{ ...actionBtnSmall, background: showCode ? `${accent}12` : 'transparent', color: showCode ? accent : 'var(--text-soft)', borderColor: showCode ? `${accent}30` : 'var(--border)' }}
            whileHover={{ scale: 1.04, borderColor: accent }}
            whileTap={{ scale: 0.96 }}
            title="Toggle code view"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            Code
          </motion.button>

          {/* Open in new tab */}
          <motion.button
            onClick={() => window.open(buildVentureSiteUrl(ventureSubdomain, ventureId), '_blank')}
            style={actionBtnSmall}
            whileHover={{ scale: 1.04, borderColor: accent }}
            whileTap={{ scale: 0.96 }}
            title="Open in new tab"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </motion.button>

          {/* Close */}
          <motion.button
            onClick={onClose}
            style={{ ...actionBtnSmall, padding: '0 6px' }}
            whileHover={{ scale: 1.04, borderColor: '#e05252' }}
            whileTap={{ scale: 0.96 }}
            title="Close preview"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </motion.button>
        </div>
      </div>

      {/* ── Preview or Code ── */}
      {showCode ? (
        <pre className="preview-code-view" style={{ flex: 1, overflow: 'auto', margin: 0, background: 'var(--bg)' }}>
          {clean}
        </pre>
      ) : (
        <div style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          background: 'var(--bg)',
          position: 'relative',
        }}>
          {/* Error banner — surfaces React render errors AND uncaught script
              errors from the iframe via postMessage. The runtime shim wraps
              the rendered App in an error boundary and also listens for
              window.error / unhandledrejection events. */}
          <AnimatePresence>
            {previewError && (
              <motion.div
                key={previewError.capturedAt}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  right: 12,
                  zIndex: 25,
                  background: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)',
                  color: '#fff',
                  borderRadius: 12,
                  padding: 14,
                  boxShadow: '0 12px 32px rgba(127,29,29,0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Preview crashed
                    </span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.18)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}>
                      {previewError.kind === 'react' ? 'React render' : previewError.kind === 'script' ? 'Script error' : previewError.kind === 'promise' ? 'Async error' : 'Runtime'}
                    </span>
                  </div>
                  <button
                    onClick={() => setPreviewError(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: 20,
                      lineHeight: 1,
                      cursor: 'pointer',
                      padding: 0,
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                    }}
                    title="Dismiss"
                    aria-label="Dismiss error"
                  >×</button>
                </div>

                <div style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 12,
                  lineHeight: 1.55,
                  wordBreak: 'break-word',
                  background: 'rgba(0,0,0,0.22)',
                  borderRadius: 8,
                  padding: '8px 10px',
                }}>
                  {previewError.message}
                </div>

                {(previewError.filename || typeof previewError.lineno === 'number') && (
                  <div style={{ fontSize: 11, opacity: 0.82, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                    {previewError.filename || 'inline'}{typeof previewError.lineno === 'number' ? `:${previewError.lineno}` : ''}{typeof previewError.colno === 'number' ? `:${previewError.colno}` : ''}
                  </div>
                )}

                {showErrorDetails && (previewError.stack || previewError.componentStack) && (
                  <pre style={{
                    margin: 0,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 10.5,
                    lineHeight: 1.5,
                    color: 'rgba(255,255,255,0.78)',
                    background: 'rgba(0,0,0,0.28)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    maxHeight: 180,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {previewError.stack || ''}{previewError.componentStack ? `\n\nComponent stack:${previewError.componentStack}` : ''}
                  </pre>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                  <button
                    onClick={handleCopyFixPrompt}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.34)',
                      background: 'rgba(255,255,255,0.16)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                      fontFamily: 'inherit',
                    }}
                  >
                    {fixPromptCopied ? '✓ Copied' : 'Copy fix prompt'}
                  </button>
                  <button
                    onClick={() => setIframeKey((k) => k + 1)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.22)',
                      background: 'transparent',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                      fontFamily: 'inherit',
                    }}
                    title="Reload the iframe"
                  >
                    Retry render
                  </button>
                  {(previewError.stack || previewError.componentStack) && (
                    <button
                      onClick={() => setShowErrorDetails((v) => !v)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.22)',
                        background: 'transparent',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        letterSpacing: '0.04em',
                        fontFamily: 'inherit',
                      }}
                    >
                      {showErrorDetails ? 'Hide stack' : 'Show stack'}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading overlay */}
          <AnimatePresence>
            {iframeLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg)',
                  zIndex: 5,
                  gap: 12,
                }}
              >
                <motion.div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: `3px solid var(--border)`,
                    borderTopColor: accent,
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Rendering preview...
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Iframe */}
          <div
            className="preview-iframe-wrap"
            style={{
              width: deviceWidths[device],
              maxWidth: '100%',
              height: '100%',
              flexShrink: 0,
              borderLeft: device !== 'desktop' ? '1px solid var(--border)' : 'none',
              borderRight: device !== 'desktop' ? '1px solid var(--border)' : 'none',
              boxShadow: device !== 'desktop' ? '0 0 40px rgba(0,0,0,0.15)' : 'none',
              borderRadius: device === 'mobile' ? 16 : device === 'tablet' ? 10 : 0,
              overflow: 'hidden',
            }}
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              title={`${ventureName} — Live Preview`}
              sandbox="allow-scripts"
              onLoad={() => setIframeLoading(false)}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
                background: '#fff',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Bottom status bar ── */}
      <div style={{
        height: 32,
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: previewError ? '#dc2626' : '#16a34a',
            boxShadow: previewError ? '0 0 6px #dc262670' : '0 0 6px #16a34a60',
            transition: 'background 0.2s, box-shadow 0.2s',
          }} />
          <span style={{ fontSize: 10, color: previewError ? '#dc2626' : 'var(--muted)', fontWeight: 500 }}>
            {previewError ? 'Preview error' : 'Live Preview'}
          </span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", opacity: 0.6 }}>
          React + Tailwind
        </span>
      </div>
    </motion.div>
  )
}
