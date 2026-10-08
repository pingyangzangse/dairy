import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { parseImages } from '../lib/images'
import { useLoginModal } from '../contexts/LoginModalContext'
import dayjs from 'dayjs'

function truncate(text, max = 60) {
  const s = String(text || '')
  return s.length > max ? s.slice(0, max) + '…' : s
}

export default function DiaryDetail({ user }) {
  const { openLoginModal } = useLoginModal()
  const { id } = useParams()
  const navigate = useNavigate()
  const [diary, setDiary] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  const [editsRemaining, setEditsRemaining] = useState(0)
  const [edits, setEdits] = useState([])
  const [editHint, setEditHint] = useState('')

  useEffect(() => {
    loadDiary()
    loadComments()
  }, [id])

  async function loadDiary() {
    try {
      const data = await api.getDiary(id)
      setDiary(data.diary)
      setCanEdit(!!data.canEdit)
      setEditsRemaining(data.editsRemaining || 0)
      if ((data.diary.edit_count || 0) > 0) {
        api.getDiaryEdits(id)
          .then(res => setEdits(res.edits || []))
          .catch(() => {})
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadComments() {
    try {
      const data = await api.getComments(id)
      setComments(data.comments || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleComment = async (e) => {
    e.preventDefault()
    if (!user) {
      openLoginModal('评论需要登录')
      return
    }
    if (!commentText.trim()) return
    try {
      await api.addComment(id, commentText)
      setCommentText('')
      loadComments()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleEditClick = () => {
    const nth = (diary?.edit_count || 0) + 1
    const remain = editsRemaining
    setEditHint(`您正在进行第 ${nth} 次编辑，还有 ${remain} 次编辑机会。`)
    setTimeout(() => {
      setEditHint('')
      navigate('/write?edit=' + diary.id)
    }, 1400)
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    setDeleting(true)
    setActionError('')
    try {
      await api.deleteDiary(id)
      navigate('/', { replace: true })
    } catch (err) {
      setActionError(err.message)
      setDeleting(false)
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-text-sub">加载中...</div>
  if (error) return <div className="flex-1 flex items-center justify-center text-red-500">{error}</div>
  if (!diary) return null

  return (
    <div className="flex-1 bg-surface">
      <div className="bg-white px-5 py-6 border-b border-stone-100">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="text-sm text-text-sub">← 返回</button>
          <div className="flex items-center gap-2">
            {canEdit && (
              <div className="relative">
                <button
                  onClick={handleEditClick}
                  className="text-xs px-3 py-1.5 rounded-full bg-primary-light text-primary"
                >
                  编辑
                </button>
                {editHint && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white text-text-main text-xs leading-relaxed rounded-xl shadow-lg border border-stone-100 px-3 py-2 z-20">
                    {editHint}
                    <div className="absolute -top-1 right-4 w-2 h-2 bg-white border-l border-t border-stone-100 rotate-45" />
                  </div>
                )}
              </div>
            )}
            {user && diary && user.id === diary.author_id && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={"text-xs px-3 py-1.5 rounded-full disabled:opacity-50 " + (confirmDelete ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500')}
              >
                {deleting ? '删除中...' : (confirmDelete ? '再点一次确认删除' : '删除')}
              </button>
            )}
          </div>
        </div>
        {actionError && <p className="text-xs text-red-500 mb-2">{actionError}</p>}
        <h1 className="text-xl font-semibold text-text-main mb-3">{diary.title}</h1>
        <p className="text-sm text-text-sub mb-4">
          {dayjs(diary.created_at).format('YYYY-MM-DD HH:mm')}
          {(diary.edit_count || 0) > 0 && <span className="ml-2 text-xs text-muted">（已编辑 {diary.edit_count} 次）</span>}
        </p>
        <div className="text-sm text-text-main leading-relaxed whitespace-pre-line mb-4">{diary.content}</div>
        {parseImages(diary.images).length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {parseImages(diary.images).map((img, idx) => (
              <img key={idx} src={img} alt="" className="rounded-xl w-full h-40 object-cover" />
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-6">
        <h3 className="text-sm font-medium text-text-main mb-4">评论 ({comments.length})</h3>
        <div className="space-y-4 mb-6">
          {comments.map(c => (
            <div key={c.id} className="bg-white rounded-xl p-4 border border-stone-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-primary-light flex items-center justify-center text-primary text-xs">
                  {(c.nick_name || c.username || 'U')[0]}
                </div>
                <span className="text-xs text-text-sub">{c.nick_name || c.username || '用户'}</span>
              </div>
              <p className="text-sm text-text-main">{c.content}</p>
            </div>
          ))}
          {comments.length === 0 && <p className="text-sm text-text-sub text-center py-4">暂无评论</p>}
        </div>

        {edits.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-text-main mb-3">修改记录</h3>
            <div className="bg-stone-50 rounded-xl p-4 space-y-2.5">
              {edits.map((edit) => (
                <div key={edit.id} className="text-xs text-text-sub leading-relaxed">
                  <span className="text-muted">{dayjs(edit.created_at).format('MM-DD HH:mm')}</span>
                  {(Array.isArray(edit.changes) ? edit.changes : []).map((chg, i) => (
                    <div key={i} className="mt-1">
                      {chg.field === 'title' && (
                        <>修改了标题：「{truncate(chg.from)}」→「{truncate(chg.to)}」</>
                      )}
                      {chg.field === 'content' && (
                        <>修改了内容：「{truncate(chg.from)}」→「{truncate(chg.to)}」</>
                      )}
                      {chg.field === 'visibility' && (
                        <>修改了可见范围：{chg.from} → {chg.to}</>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleComment} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder={user ? "写下你的评论..." : "登录后才能评论"}
            disabled={!user}
            className="flex-1 px-4 py-2 rounded-full bg-stone-50 border border-stone-200 focus:border-primary focus:outline-none text-sm disabled:opacity-60"
          />
          <button type="submit" className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium">
            {user ? '发送' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
