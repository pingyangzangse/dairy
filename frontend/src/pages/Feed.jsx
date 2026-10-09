import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoginModal } from '../contexts/LoginModalContext'
import DiaryCard from '../components/DiaryCard'
import PageHeader from '../components/PageHeader'

export default function Feed({ user }) {
  const navigate = useNavigate()
  const { openLoginModal } = useLoginModal()
  const location = useLocation()
  const [toast, setToast] = useState(location.state?.toast || '')

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3000)
      window.history.replaceState({}, '')
      return () => clearTimeout(t)
    }
  }, [toast])
  const [mode, setMode] = useState('all')
  const [diaries, setDiaries] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  const modes = [
    { key: 'all', label: '广场' },
    { key: 'following', label: '关注' },
    { key: 'friend', label: '朋友' },
    { key: 'family', label: '家人' },
    { key: 'partner', label: '伴侣' },
  ]

  async function loadData(reset = false) {
    const currentPage = reset ? 1 : page
    setLoading(true)
    setError('')
    try {
      const data = await api.feed(mode, currentPage)
      const list = data.diaries || []
      setDiaries(prev => reset ? list : [...prev, ...list])
      setHasMore(list.length === (data.pageSize || 10))
      if (reset) setPage(1)
    } catch (err) {
      if (err.status === 401) {
        setError('该功能需要登录')
        setDiaries([])
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(true)
  }, [mode])

  const handleModeChange = (key) => {
    if (key !== 'all' && !user) {
      openLoginModal('该功能需要登录后才能使用')
      return
    }
    setMode(key)
    setFilterOpen(false)
  }

  const currentLabel = modes.find(m => m.key === mode)?.label || '广场'

  const handleWrite = () => {
    if (!user) {
      openLoginModal('写日记需要登录')
      return
    }
    navigate('/write')
  }

  return (
    <div className="flex-1 bg-surface">
      <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-stone-100">
        <PageHeader
          title="日记广场"
          right={
            <button
              onClick={handleWrite}
              className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium"
            >
              写日记
            </button>
          }
        />
        <div className="px-4 pb-3">
          <button
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-sm bg-white border border-stone-200 text-text-main"
          >
            <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10m-7 8h4" />
            </svg>
            {currentLabel}
            <svg className="w-3 h-3 text-text-sub" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {toast && (
          <div className="bg-primary text-white text-sm text-center rounded-2xl py-3 shadow-sm">
            {toast}
          </div>
        )}
        {error && (
          <div className="bg-white rounded-2xl p-4 text-center text-sm text-text-sub border border-stone-100">
            {error}
            {!user && (
              <button
                onClick={() => navigate('/login')}
                className="block mx-auto mt-2 px-4 py-1.5 bg-primary text-white rounded-full text-xs"
              >
                去登录
              </button>
            )}
          </div>
        )}

        {diaries.map(diary => (
          <DiaryCard key={diary.id} diary={diary} />
        ))}

        {!loading && !error && diaries.length === 0 && (
          <div className="text-center py-12 text-text-sub text-sm">
            还没有日记，{user ? '写第一篇吧' : '登录后可以查看更多'}
          </div>
        )}

        {hasMore && !loading && diaries.length > 0 && (
          <button
            onClick={() => { setPage(p => p + 1); loadData() }}
            className="w-full py-3 bg-white rounded-2xl text-sm text-text-sub border border-stone-100"
          >
            加载更多
          </button>
        )}

        {loading && <div className="text-center py-4 text-text-sub text-sm">加载中...</div>}
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setFilterOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
            <h3 className="text-base font-semibold text-text-main mb-4">查看范围</h3>
            <div className="space-y-2">
              {modes.map(m => (
                <button
                  key={m.key}
                  onClick={() => handleModeChange(m.key)}
                  className={"w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm " + (mode === m.key ? 'border-primary bg-primary-light text-primary' : 'border-stone-200 text-text-main')}
                >
                  <span>{m.label}</span>
                  {mode === m.key && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
