export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F1923',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#fff',
    }}>
      {/* HP Logo bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: '#0096D6',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, color: '#fff' }}>hp</span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }}>|</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: 1 }}>
          PURSUIT<span style={{ color: '#fff' }}>360</span>
        </span>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: 640 }}>
        <div style={{
          display: 'inline-block',
          background: 'rgba(0,150,214,0.15)',
          border: '1px solid rgba(0,150,214,0.3)',
          borderRadius: 999,
          padding: '6px 18px',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 2,
          color: '#0096D6',
          textTransform: 'uppercase',
          marginBottom: 24,
        }}>
          Internal · MPS Solution Architects
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 64px)',
          fontWeight: 800,
          margin: '0 0 16px',
          lineHeight: 1.1,
          letterSpacing: -1,
        }}>
          Pursuit<span style={{ color: '#0096D6' }}>360</span>
        </h1>

        <p style={{
          fontSize: 18,
          color: 'rgba(255,255,255,0.55)',
          margin: '0 0 40px',
          lineHeight: 1.6,
        }}>
          The pursuit intelligence platform for HP Managed Print Services solution architects.
          Deal governance, SOAR workflows, and solution design — in one place.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{
            background: '#0096D6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '14px 28px',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}>
            Get started →
          </button>
          <button style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            padding: '14px 28px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            View demo
          </button>
        </div>
      </div>

      {/* Coming soon strip */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(0,150,214,0.08)',
        borderTop: '1px solid rgba(0,150,214,0.15)',
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
        Building in progress — more coming soon
      </div>
    </div>
  )
}
