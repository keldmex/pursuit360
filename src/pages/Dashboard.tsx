import type { SAUser } from '../lib/users'

export default function Dashboard({ user, onLogout, onNavigate }: { user: SAUser; onLogout: () => void; onNavigate: (page: string) => void }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F1923',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#fff',
    }}>
      {/* Top nav */}
      <nav style={{
        background: '#0096D6',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/hp-logo.svg" alt="HP" style={{ width: 36, height: 36 }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }}>|</span>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>PURSUIT360</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: user.avatar_color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff',
          }}>
            {user.initials}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{user.name}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{user.level} · {user.region}</p>
          </div>
          <button onClick={onLogout} style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 12,
            padding: '6px 12px',
            cursor: 'pointer',
            marginLeft: 8,
          }}>
            Sign out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div style={{ padding: '40px 32px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Welcome */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px' }}>
            Welcome back, {user.name.split(' ')[0]} 👋
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16, margin: 0 }}>
            {user.level} · {user.region} · {user.years} years experience
          </p>
        </div>

        {/* Specialisms */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 40, flexWrap: 'wrap' }}>
          {user.specialisms.map(s => (
            <span key={s} style={{
              background: 'rgba(0,150,214,0.12)',
              border: '1px solid rgba(0,150,214,0.25)',
              color: '#0096D6',
              borderRadius: 999,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
            }}>{s}</span>
          ))}
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 40 }}>
          {[
            { label: 'Active Pursuits', value: '—', icon: '🎯', hint: 'Coming soon' },
            { label: 'SOAR Approvals', value: '—', icon: '✅', hint: 'Coming soon' },
            { label: 'Deals Won YTD', value: '—', icon: '🏆', hint: 'Coming soon' },
            { label: 'Pipeline TCV', value: '—', icon: '💰', hint: 'Coming soon' },
          ].map(card => (
            <div key={card.label} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '20px 22px',
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>{card.label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px' }}>{card.value}</p>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, margin: 0 }}>{card.hint}</p>
            </div>
          ))}
        </div>

        {/* Module grid */}
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20 }}>
          Modules
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {[
            { title: 'Pursuit Pipeline', icon: '🎯', desc: 'Track active deals, stages, and TCV across your region.', route: null },
            { title: 'SOAR Workflow', icon: '📋', desc: 'Manage OA, BA and T&C SOAR approvals end-to-end.', route: null },
            { title: 'Solution Designer', icon: '🏗️', desc: 'Build MPS solution architectures with fleet and software design.', route: null },
            { title: 'Risk Log', icon: '⚠️', desc: 'Identify, quantify, and mitigate pursuit risks in real time.', route: null },
            { title: 'DART / Pricing', icon: '💹', desc: 'Connect to DART IPC Portal and track pricing strategy.', route: null },
            { title: 'Proposal Builder', icon: '📄', desc: 'Generate RFP responses, BA SOAR decks, and executive summaries.', route: null },
            { title: 'Quality Standards', icon: '✅', desc: 'SA quality bar, best practices, and self-assessment checklist.', route: 'quality-standards' },
          ].map(mod => (
            <div key={mod.title}
              onClick={() => mod.route && onNavigate(mod.route)}
              style={{
                background: mod.route ? 'rgba(0,150,214,0.06)' : 'rgba(255,255,255,0.03)',
                border: mod.route ? '1px solid rgba(0,150,214,0.25)' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
                padding: '22px 22px',
                cursor: mod.route ? 'pointer' : 'default',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{mod.icon}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{mod.title}</h3>
                {mod.route
                  ? <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(0,150,214,0.2)', color: '#0096D6', borderRadius: 999, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: 1 }}>Open →</span>
                  : <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(0,150,214,0.1)', color: '#0096D6', borderRadius: 999, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: 1 }}>Soon</span>
                }
              </div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{mod.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
