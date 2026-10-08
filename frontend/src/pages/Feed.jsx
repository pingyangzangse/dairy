import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
import DiaryCard from '../components/DiaryCard'

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'following', label: '关注' },
  { key: 'partner', label: '伴侣' },
]

export default function Feed() {
  const [mode, setMode] = useState('all')
  const [diaries, setDiaries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const observerRef = useRef()

  const loadFeed = async (pageNum = 1, reset = false) => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getFeed(mode, pageNum, 10)
      if (reset) {
        setDiaries(data.diaries)
      } else {
        setDiaries(prev => [...prev, ...data.diaries])
      }
      setHasMore(data.diaries.length === 10 && data.total > pageNum * 10)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    loadFeed(1, true)
  }, [mode])

  useEffect(() => {
    if (page === 1) return
    loadFeed(page)
  }, [page])

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        setPage(p => p + 1)
      }
    }, { threshold: 0.1 })
    if (observerRef.current) observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading])

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-text-main">日记广场</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={"px-4 py-1.5 rounded-full text-sm font-medium transition-colors " + (mode === tab.key ? 'bg-primary text-white' : 'bg-white text-text-sub border border-stone-200')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {diaries.length === 0 && !loading && (
        <div className="text-center py-20 text-muted text-sm">
          <p>这里还没有日记</p>
          <p className="mt-1">去写一篇吧</p>
        </div>
      )}

      {diaries.map(diary => <DiaryCard key={diary.id} diary={diary} />)}

      <div ref={observerRef} className="h-8 flex items-center justify-center text-xs text-muted">
        {loading ? '加载中...' : (hasMore ? '上拉加载更多' : '到底了')}
      </div>
    </div>
  )
}
