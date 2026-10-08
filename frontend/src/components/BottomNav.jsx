import { Link, useLocation } from 'react-router-dom'

const tabs = [
  { path: '/', label: '首页', icon: homeIcon },
  { path: '/write', label: '写日记', icon: penIcon },
  { path: '/profile', label: '我的', icon: userIcon },
]

function homeIcon(active) {
  return (
    <svg className={"w-6 h-6 " + (active ? 'text-primary' : 'text-muted')} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function penIcon(active) {
  return (
    <svg className={"w-6 h-6 " + (active ? 'text-primary' : 'text-muted')} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}

function userIcon(active) {
  return (
    <svg className={"w-6 h-6 " + (active ? 'text-primary' : 'text-muted')} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

export default function BottomNav() {
  const location = useLocation()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-stone-100 z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {tabs.map(tab => {
          const active = location.pathname === tab.path
          return (
            <Link key={tab.path} to={tab.path} className="flex flex-col items-center gap-1 py-2 px-4">
              {tab.icon(active)}
              <span className={"text-xs " + (active ? 'text-primary font-medium' : 'text-muted')}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
