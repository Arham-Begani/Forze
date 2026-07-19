// Presentation constants for the venture module page.
//
// Split out of page.tsx purely to shrink it — these are static style objects
// and small style factories with no state, no imports from the page, and no
// behavior. Nothing here should ever gain logic; if a value needs to react to
// state, compute it in the component instead.

import type React from 'react'

export const docTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: 'var(--text)',
  marginBottom: 4,
  letterSpacing: '-0.01em',
}

export const panelActionBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--glass-border)',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text-soft)',
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
}

// ─── Styles ──────────────────────────────────────────────────────────────────

export const headerStyle: React.CSSProperties = {
  height: 54,
  padding: '0 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid var(--border)',
  background: 'var(--glass-bg-strong)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  flexShrink: 0,
  position: 'relative',
  zIndex: 10,
}

export const headerIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

export function agentBadgeStyle(accent: string): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    color: accent,
    background: `${accent}12`,
    border: `1px solid ${accent}28`,
    borderRadius: 20,
    padding: '4px 12px',
    letterSpacing: '0.02em',
    boxShadow: `0 2px 8px ${accent}18`,
  }
}

export const chatInnerStyle: React.CSSProperties = {
  maxWidth: 780,
  margin: '0 auto',
  padding: '24px 16px 32px',
  width: '100%',
}

export const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 'calc(100vh - 240px)',
  padding: '0 24px',
}

export function chipStyle(accent: string): React.CSSProperties {
  return {
    fontSize: 12,
    color: accent,
    background: `${accent}0d`,
    border: `1px solid ${accent}22`,
    borderRadius: 20,
    padding: '8px 16px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 150ms, box-shadow 150ms',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left',
    lineHeight: 1.4,
  }
}

export const userBubbleStyle: React.CSSProperties = {
  maxWidth: '85%',
  fontSize: 14,
  color: 'var(--text)',
  background: 'var(--glass-bg-strong)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid var(--glass-border)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  borderRadius: '20px 20px 4px 20px',
  padding: '12px 16px',
  lineHeight: 1.6,
  letterSpacing: '0.01em',
}

export const avatarStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

export const errorBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '14px 18px',
  background: 'rgba(220, 38, 38, 0.05)',
  border: '1px solid rgba(220, 38, 38, 0.15)',
  borderRadius: 14,
}

export const retryBtnStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#e05252',
  background: 'transparent',
  border: '1px solid rgba(220, 38, 38, 0.25)',
  borderRadius: 10,
  padding: '7px 14px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'background 150ms',
}

export const inputAreaStyle: React.CSSProperties = {
  background: 'var(--glass-bg-strong)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  borderTop: '1px solid var(--border)',
  padding: '12px 16px 18px',
  flexShrink: 0,
  zIndex: 10,
  position: 'relative',
}

export const inputInnerStyle: React.CSSProperties = {
  maxWidth: 780,
  margin: '0 auto',
}

export const inputWrapStyle: React.CSSProperties = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid var(--glass-border)',
  borderRadius: 18,
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  position: 'relative',
  transition: 'border-color 250ms ease, box-shadow 250ms ease',
}

export function modulePickerPillStyle(accent: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px',
    borderRadius: 20,
    border: `1px solid ${accent}28`,
    background: `${accent}0d`,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 150ms',
  }
}

export const pickerDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: 0,
  background: 'var(--glass-bg-strong)',
  backdropFilter: 'blur(32px)',
  WebkitBackdropFilter: 'blur(32px)',
  border: '1px solid var(--glass-border)',
  borderRadius: 14,
  padding: 6,
  zIndex: 20,
  minWidth: 190,
  boxShadow: 'var(--shadow-xl)',
}

export const pickerOptionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
  transition: 'background 100ms',
}

export const textareaStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: 14,
  color: 'var(--text)',
  fontFamily: 'inherit',
  resize: 'none',
  lineHeight: 1.55,
  padding: 0,
  overflow: 'hidden',
}

export const sendBtnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'background 200ms, box-shadow 200ms',
}

export const kbdStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--muted)',
  background: 'var(--glass-bg)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  padding: '2px 6px',
  fontFamily: "'JetBrains Mono', monospace",
  lineHeight: 1.4,
}
