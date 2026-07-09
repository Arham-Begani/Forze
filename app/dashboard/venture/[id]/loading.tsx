// Instant skeleton for the venture overview while its server component runs
// getVenture() on the server. Without this, client-side navigation to a venture
// showed nothing until the DB round-trip returned. Next.js streams this in
// immediately, so the page feels responsive even before data lands.
export default function VentureLoading() {
  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: 220, height: 20, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 140, height: 13, borderRadius: 6 }} />
        </div>
      </div>

      {/* Card grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 18,
              background: 'var(--card-solid, var(--glass-bg))',
            }}
          >
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8, marginBottom: 14 }} />
            <div className="skeleton" style={{ width: '70%', height: 15, borderRadius: 6, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: '90%', height: 12, borderRadius: 6, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: '55%', height: 12, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
