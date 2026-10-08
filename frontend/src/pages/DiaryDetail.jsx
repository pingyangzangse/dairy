import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { api } from '../lib/api'

const visibilityMap = {
  public: { label: '公开', color: 'bg-stone-100 text-stone-600' },
  partner: { label: '仅伴侣', color: 'bg-primary-light text-primary' },
  private: { label: '仅自己', color: 'bg-amber-50 text-amber-600' },
}

export default function DiaryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [diary, setDiary] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [diaryData, commentsData] = await Promise.all([
        api.getDiary(id),
        api.getComments(id),
      ])
      setDiary(diaryData.diary)
      setComments(commentsData.comments)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePostComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) return
    try {
      const data = await api.postComment(id, commentText)
      setComments(prev => [...prev, data.comment])
      setCommentText('')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async () => {
    if (!confirm('确定要删除这篇日记吗？')) return
    try {
      await api.deleteDiary(id)
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="p-8 text-center text-muted">加载中...</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>
  if (!diary) return null

  const images = diary.images ? JSON.parse(diary.images) : []
  const v = visibilityMap[diary.visibility] || visibilityMap.public

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <div className="bg-white p-4 border-b border-stone-100">
        <button onClick={() => navigate(-1)} className="text-sm text-muted">← 返回</button>
      </div>

      <div className="bg-white p-4 mb-3">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-medium text-sm overflow-hidden">
            {diary.author?.avatar ? (
              <img src={diary.author.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              (diary.author?.nick_name || diary.author?.username || '?').slice(0, 1)
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-text-main">{diary.author?.nick_name || diary.author?.username}</div>
            <div className="text-xs text-muted">{dayjs(diary.created_at).format('YYYY-MM-DD HH:mm')}</div>
          </div>
          <span className={"text-xs px-2 py-1 rounded-full " + v.color}>{v.label}</span>
        </div>

        {diary.title && <h1 className="text-lg font-semibold text-text-main mb-3">{diary.title}</h1>}
        <p className="text-sm text-text-sub leading-relaxed whitespace-pre-wrap mb-4">{diary.content}</p>

        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {images.map((url, idx) => (
              <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-stone-100">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white p-4 mb-3">
        <h3 className="text-sm font-semibold text-text-main mb-3">评论</h3>
        {comments.length === 0 && <p className="text-sm text-muted">还没有评论</p>}
        <div className="space-y-4 mb-4">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary text-xs font-medium shrink-0">
                {(c.nick_name || c.username || '?').slice(0, 1)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-main">{c.nick_name || c.username}</span>
                  <span className="text-xs text-muted">{dayjs(c.created_at).format('MM-DD HH:mm')}</span>
                </div>
                <p className="text-sm text-text-sub mt-1">{c.content}</p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handlePostComment} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="写下你的评论..."
            className="flex-1 px-4 py-2 rounded-full bg-stone-50 border border-stone-200 focus:border-primary focus:outline-none text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium">发送</button>
        </form>
      </div>
    </div>
  )
}
