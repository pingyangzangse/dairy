import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useLoginModal } from '../contexts/LoginModalContext'
import { api } from '../lib/api'

export default function BottomNav({ user }) {
  const navigate = useNavigate()
  const { openLoginModal } = useLoginModal()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnread(0)
      return
    }
    let stopped = false
    const load = () => {
      api.getUnreadCount()
        .then(d => { if (!stopped) setUnread(d.count || 0) })
        .catch(() => {})
    }
    load()
    const timer = setInterval(load, 30000)
    // 其他页面标记已读后广播，红点立即消失
    const onRead = () => load()
    window.addEventListener('diary:notifications-read', onRead)
    return () => {
      stopped = true
      clearInterval(timer)
      window.removeEventListener('diary:notifications-read', onRead)
    }
  }, [user])

  const items = [
    { to: '/', label: '广场', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { to: '/bind', label: '绑定', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { to: '/profile', label: '我的', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', badge: unread },
  ]

  const handleClick = (to) => (e) => {
    if (!user && (to === '/bind' || to === '/profile')) {
      e.preventDefault()
      openLoginModal('该功能需要登录后才能使用')
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 px-6 py-2 safe-area-pb">
      <div className="max-w-md mx-auto flex justify-around items-center">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={handleClick(item.to)}
            className={({ isActive }) => "flex flex-col items-center gap-1 py-1 px-4 " + (isActive ? 'text-primary' : 'text-text-sub')}
          >
            <span className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.badge > 0 && (
                <span className="absolute -top-0.5 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[9px] leading-[14px] text-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </span>
            <span className="text-[10px]">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
