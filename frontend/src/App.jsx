import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { api } from './lib/api'
import Login from './pages/Login'
import Feed from './pages/Feed'
import Write from './pages/Write'
import DiaryDetail from './pages/DiaryDetail'
import Profile from './pages/Profile'
import Bind from './pages/Bind'
import BottomNav from './components/BottomNav'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    const token = api.getToken()
    if (!token) {
      setLoading(false)
      return
    }
    api.me()
      .then(data => setUser(data))
      .catch(() => api.removeToken())
      .finally(() => setLoading(false))
  }, [])

  const handleLogin = (data) => {
    api.setToken(data.token)
    setUser(data.user)
  }

  const handleLogout = () => {
    api.logout().catch(() => {})
    api.removeToken()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-muted">加载中...</div>
      </div>
    )
  }

  const publicRoutes = ['/login']
  const isPublic = publicRoutes.includes(location.pathname)

  if (!user && !isPublic) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] max-w-md mx-auto shadow-xl flex flex-col">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />} />
          <Route path="/" element={<Feed />} />
          <Route path="/write" element={<Write />} />
          <Route path="/diary/:id" element={<DiaryDetail />} />
          <Route path="/profile" element={<Profile user={user} onLogout={handleLogout} onUpdate={setUser} />} />
          <Route path="/bind" element={<Bind />} />
        </Routes>
      </div>
      {user && <BottomNav />}
    </div>
  )
}

export default App
