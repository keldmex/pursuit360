import { useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import type { SAUser } from './lib/users'

export default function App() {
  const [user, setUser] = useState<SAUser | null>(() => {
    try {
      const stored = sessionStorage.getItem('p360_user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  const handleLogin = (u: SAUser) => {
    sessionStorage.setItem('p360_user', JSON.stringify(u))
    setUser(u)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('p360_user')
    setUser(null)
  }

  if (!user) return <Login onLogin={handleLogin} />
  return <Dashboard user={user} onLogout={handleLogout} />
}
