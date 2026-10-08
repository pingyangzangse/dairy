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
import LoginModal from './components/LoginModal'
import { LoginModalProvider } from './contexts/LoginModalContext'

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

  const isLoginPage = location.pathname === '/login'

  return (
    <LoginModalProvider>
    <div className="min-h-screen bg-surface pb-20">
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/" element={<Feed user={user} />} />
        <Route path="/write" element={<Write user={user} />} />
        <Route path="/diaries/:id" element={<DiaryDetail user={user} />} />
        <Route path="/profile" element={<Profile user={user} onLogout={handleLogout} />} />
        <Route path="/bind" element={<Bind user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isLoginPage && <BottomNav user={user} />}
      <LoginModal />
    </div>
    </LoginModalProvider>
  )
}

export default App
