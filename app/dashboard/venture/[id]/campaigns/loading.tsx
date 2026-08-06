// Instant skeleton for the Outreach campaign list, which fetches the venture and
// its campaigns in parallel on mount.
export default function CampaignsLoading() {
  return (
    <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 16,
        }}
      >
        <div>
          <div className="skeleton" style={{ width: 160, height: 22, borderRadius: 7, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 250, height: 13, borderRadius: 6 }} />
        </div>
        <div className="skeleton" style={{ width: 132, height: 34, borderRadius: 10, flexShrink: 0 }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 18,
              background: 'var(--card-solid, var(--glass-bg))',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: '45%', height: 14, borderRadius: 6, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '70%', height: 11, borderRadius: 6 }} />
            </div>
            <div className="skeleton" style={{ width: 76, height: 22, borderRadius: 7, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
