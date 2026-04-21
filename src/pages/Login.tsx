import { useState } from 'react'
import { authenticate, type SAUser } from '../lib/users'

export default function Login({ onLogin }: { onLogin: (user: SAUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setTimeout(() => {
      const user = authenticate(email, password)
      if (user) {
        onLogin(user)
      } else {
        setError('Invalid email or password.')
      }
      setLoading(false)
    }, 600)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F1923',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Top bar */}
      <div style={{
        background: '#0096D6',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>hp</span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }}>|</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: 1 }}>
          PURSUIT<span style={{ color: '#fff' }}>360</span>
        </span>
      </div>

      {/* Login card */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '40px 36px',
          width: '100%',
          maxWidth: 400,
        }}>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Sign in</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 32 }}>
            MPS Solution Architect Portal
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your.name@hp-pursuit360.demo"
                required
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(220,38,38,0.1)',
                border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#FCA5A5',
                fontSize: 13,
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? 'rgba(0,150,214,0.5)' : '#0096D6',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '13px',
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? 'default' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          {/* Demo hint */}
          <div style={{
            marginTop: 28,
            padding: '14px 16px',
            background: 'rgba(0,150,214,0.08)',
            border: '1px solid rgba(0,150,214,0.2)',
            borderRadius: 8,
          }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Demo accounts</p>
            {[
              { name: 'Sarah Chen', email: 'sarah.chen@hp-pursuit360.demo', level: 'Senior SA · APAC' },
              { name: 'Marco De Luca', email: 'marco.deluca@hp-pursuit360.demo', level: 'Lead SA · EMEA' },
              { name: 'Priya Sharma', email: 'priya.sharma@hp-pursuit360.demo', level: 'SA · EMEA' },
              { name: 'James Okonkwo', email: 'james.okonkwo@hp-pursuit360.demo', level: 'Principal SA · Americas' },
            ].map(u => (
              <button
                key={u.email}
                type="button"
                onClick={() => { setEmail(u.email); setPassword('Demo-SA-2026') }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: '5px 0',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{u.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{u.level}</span>
              </button>
            ))}
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 8 }}>Password: Demo-SA-2026</p>
          </div>
        </div>
      </div>
    </div>
  )
}
