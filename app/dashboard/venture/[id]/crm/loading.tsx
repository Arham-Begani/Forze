// Instant skeleton for the CRM workspace. Its page is a server component that
// runs getVenture() before the client dashboard mounts, and the client then
// fans out to analytics, inbox and leads — so without this the tab looked frozen
// on the previous page for the whole chain.
export default function CrmLoading() {
  return (
    <div style={{ padding: '28px 24px', maxWidth: 1180, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div className="skeleton" style={{ width: 180, height: 22, borderRadius: 7, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 280, height: 13, borderRadius: 6 }} />
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ width: 92, height: 32, borderRadius: 9 }} />
        ))}
      </div>

      {/* Stat row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 16,
              background: 'var(--card-solid, var(--glass-bg))',
            }}
          >
            <div className="skeleton" style={{ width: '60%', height: 11, borderRadius: 6, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: 64, height: 22, borderRadius: 7 }} />
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '14px 16px',
              borderBottom: i === 5 ? 'none' : '1px solid var(--border)',
            }}
          >
            <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
            <div className="skeleton" style={{ flex: 2, height: 12, borderRadius: 6 }} />
            <div className="skeleton" style={{ flex: 3, height: 12, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 70, height: 20, borderRadius: 6, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
