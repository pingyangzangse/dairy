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
  const [commentInputOpen, setCommentInputOpen] = useState(false)
  const [replyTarget, setReplyTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')
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

  const openNewComment = () => {
    if (!user) {
      openLoginModal('评论需要登录')
      return
    }
    setReplyTarget(null)
    setCommentError('')
    setCommentInputOpen(true)
  }

  const openReply = (target) => {
    if (!user) {
      openLoginModal('回复评论需要登录')
      return
    }
    setCommentInputOpen(false)
    setCommentError('')
    setReplyTarget(target)
  }

  const handleSubmitComment = async (e) => {
    e.preventDefault()
    const text = commentText.trim()
    if (!text || submitting) return
    setSubmitting(true)
    setCommentError('')
    try {
      await api.addComment(id, text, replyTarget ? replyTarget.id : null)
      setCommentText('')
      setCommentInputOpen(false)
      setReplyTarget(null)
      loadComments()
    } catch (err) {
      setCommentError(err.message)
    } finally {
      setSubmitting(false)
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

  // 评论线程化：找出每条评论所属的“根”评论
  const byId = Object.fromEntries(comments.map(c => [c.id, c]))
  const rootOf = (c) => {
    let cur = c
    while (cur && cur.parent_id && byId[cur.parent_id]) cur = byId[cur.parent_id]
    return cur
  }
  const roots = comments.filter(c => !c.parent_id || !byId[c.parent_id])
  const childrenOf = (rootId) => comments.filter(c => c.id !== rootId && rootOf(c).id === rootId)
  const replyRootId = replyTarget ? rootOf(replyTarget).id : null
  const commenterName = (c) => c.nick_name || c.username || '用户'

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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-main">评论 ({comments.length})</h3>
          <button
            onClick={openNewComment}
            aria-label="发表评论"
            className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.1 2.1 0 012.97 2.97L8.475 17.814a2 2 0 01-.95.528l-3.02.755.755-3.02a2 2 0 01.528-.95L16.862 3.487z" />
            </svg>
          </button>
        </div>

        {commentInputOpen && (
          <form onSubmit={handleSubmitComment} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="写下你的评论..."
                className="flex-1 min-w-0 px-4 py-2 rounded-full bg-stone-50 border border-stone-200 focus:border-primary focus:outline-none text-sm"
              />
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium disabled:opacity-50 flex-shrink-0">
                发送
              </button>
              <button type="button" onClick={() => { setCommentInputOpen(false); setCommentText('') }} className="px-3 py-2 text-text-sub text-sm flex-shrink-0">
                取消
              </button>
            </div>
          </form>
        )}
        {commentError && <p className="text-xs text-red-500 mb-3">{commentError}</p>}

        {comments.length === 0 && !commentInputOpen && (
          <p className="text-sm text-text-sub text-center py-6">
            当前没有任何评论，点击
            <button onClick={openNewComment} className="text-primary font-medium mx-0.5">发表评论</button>
          </p>
        )}

        <div className="space-y-3 mb-6">
          {roots.map(c => (
            <div key={c.id}>
              <button onClick={() => openReply(c)} className="w-full text-left bg-white rounded-xl p-4 border border-stone-100">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-full bg-primary-light flex items-center justify-center text-primary text-xs flex-shrink-0">
                    {commenterName(c)[0]}
                  </div>
                  <span className="text-xs text-text-sub">{commenterName(c)}</span>
                  <span className="text-[10px] text-muted ml-auto">{dayjs(c.created_at).format('MM-DD HH:mm')}</span>
                </div>
                <p className="text-sm text-text-main">{c.content}</p>
              </button>

              {childrenOf(c.id).length > 0 && (
                <div className="ml-5 mt-2 space-y-2 border-l-2 border-stone-100 pl-3">
                  {childrenOf(c.id).map(r => (
                    <button key={r.id} onClick={() => openReply(r)} className="w-full text-left bg-white rounded-xl p-3 border border-stone-100">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center text-primary text-[10px] flex-shrink-0">
                          {commenterName(r)[0]}
                        </div>
                        <span className="text-xs text-text-sub">{commenterName(r)}</span>
                        {r.parent_id && byId[r.parent_id] && byId[r.parent_id].id !== c.id && (
                          <span className="text-[10px] text-muted">回复 @{commenterName(byId[r.parent_id])}</span>
                        )}
                        <span className="text-[10px] text-muted ml-auto">{dayjs(r.created_at).format('MM-DD HH:mm')}</span>
                      </div>
                      <p className="text-sm text-text-main">{r.content}</p>
                    </button>
                  ))}
                </div>
              )}

              {replyTarget && replyRootId === c.id && (
                <form onSubmit={handleSubmitComment} className="mt-2 ml-5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder={'回复 @' + commenterName(replyTarget)}
                      className="flex-1 min-w-0 px-4 py-2 rounded-full bg-stone-50 border border-stone-200 focus:border-primary focus:outline-none text-sm"
                    />
                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium disabled:opacity-50 flex-shrink-0">
                      发送
                    </button>
                    <button type="button" onClick={() => { setReplyTarget(null); setCommentText('') }} className="px-3 py-2 text-text-sub text-sm flex-shrink-0">
                      取消
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
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

      </div>
    </div>
  )
}
