import { useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import QualityStandards from './pages/QualityStandards'
import SolutionDesigner from './pages/SolutionDesigner'
import type { SAUser } from './lib/users'

type Page = 'dashboard' | 'quality-standards' | 'solution-designer'

export default function App() {
  const [user, setUser] = useState<SAUser | null>(() => {
    try {
      const stored = sessionStorage.getItem('p360_user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [page, setPage] = useState<Page>('dashboard')

  const handleLogin = (u: SAUser) => {
    sessionStorage.setItem('p360_user', JSON.stringify(u))
    setUser(u)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('p360_user')
    setUser(null)
    setPage('dashboard')
  }

  if (!user) return <Login onLogin={handleLogin} />
  if (page === 'quality-standards') return <QualityStandards user={user} onBack={() => setPage('dashboard')} />
  if (page === 'solution-designer') return <SolutionDesigner user={user} onBack={() => setPage('dashboard')} />
  return <Dashboard user={user} onLogout={handleLogout} onNavigate={(p) => setPage(p as Page)} />
}
