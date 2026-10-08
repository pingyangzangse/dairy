import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoginModal } from '../contexts/LoginModalContext'
import DiaryCard from '../components/DiaryCard'
import PageHeader from '../components/PageHeader'

export default function Feed({ user }) {
  const navigate = useNavigate()
  const { openLoginModal } = useLoginModal()
  const [mode, setMode] = useState('all')
  const [diaries, setDiaries] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const modes = [
    { key: 'all', label: '广场' },
    { key: 'following', label: '关注' },
    { key: 'partner', label: '亲友' },
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
    if ((key === 'following' || key === 'partner') && !user) {
      openLoginModal('该功能需要登录后才能使用')
      return
    }
    setMode(key)
  }

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
          <div className="flex gap-2">
            {modes.map(m => (
            <button
              key={m.key}
              onClick={() => handleModeChange(m.key)}
              className={"px-4 py-1.5 rounded-full text-sm " + (mode === m.key ? 'bg-primary text-white' : 'bg-white text-text-sub border border-stone-100')}
            >
              {m.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
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
    </div>
  )
}
