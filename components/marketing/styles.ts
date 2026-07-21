import type { CSSProperties } from 'react'

// Shared chrome for the Social tab. Extracted from ConnectedChannelsPanel so
// ImageStudio and PostPreview render identical controls without importing
// from the panel that imports them (circular).

export const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--sidebar)',
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
}

export function buttonStyle(kind: 'primary' | 'secondary' | 'danger'): CSSProperties {
  if (kind === 'primary') {
    return {
      border: 'none',
      borderRadius: 12,
      background: 'linear-gradient(135deg, #8C5A7A, #B26F95)',
      color: '#fff',
      padding: '10px 14px',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
    }
  }

  if (kind === 'danger') {
    return {
      border: '1px solid rgba(220, 38, 38, 0.2)',
      borderRadius: 12,
      background: 'rgba(220, 38, 38, 0.08)',
      color: '#dc2626',
      padding: '10px 14px',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
    }
  }

  return {
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'transparent',
    color: 'var(--text)',
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}

export const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  color: 'var(--accent)',
}

// Editor + live preview side by side, stacking under ~900px.
export const editorGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 16,
  alignItems: 'start',
}
