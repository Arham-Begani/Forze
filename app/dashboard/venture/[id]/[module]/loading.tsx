// Instant skeleton for a module workspace. Matches the chat layout the page
// renders: a header strip, a couple of past-run blocks, and the composer.
// Without this, navigating to a module showed the previous page until the route
// segment resolved.
export default function ModuleLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 20px',
          height: 56,
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 150, height: 15, borderRadius: 6 }} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ width: 84, height: 28, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 84, height: 28, borderRadius: 8 }} />
        </div>
      </div>

      {/* Conversation body */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '24px 20px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                className="skeleton"
                style={{ width: 260, height: 34, borderRadius: 12, alignSelf: 'flex-end' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="skeleton" style={{ width: 22, height: 22, borderRadius: 7 }} />
                <div className="skeleton" style={{ width: 110, height: 12, borderRadius: 6 }} />
              </div>
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 18,
                  background: 'var(--card-solid, var(--glass-bg))',
                }}
              >
                <div className="skeleton" style={{ width: '65%', height: 14, borderRadius: 6, marginBottom: 10 }} />
                <div className="skeleton" style={{ width: '95%', height: 11, borderRadius: 6, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: '88%', height: 11, borderRadius: 6, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: '45%', height: 11, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div style={{ padding: '0 20px 20px', flexShrink: 0 }}>
        <div
          className="skeleton"
          style={{ maxWidth: 780, margin: '0 auto', height: 62, borderRadius: 16 }}
        />
      </div>
    </div>
  )
}
