import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoginModal } from '../contexts/LoginModalContext'

const groupOptions = [
  { key: 'partner', label: '伴侣' },
  { key: 'friend', label: '朋友' },
  { key: 'family', label: '家人' },
]
const exclusiveOptions = [
  { key: 'public', label: '公开', desc: '所有人可见' },
  { key: 'private', label: '仅自己', desc: '只有自己可见' },
]
const labelOf = { partner: '伴侣', friend: '朋友', family: '家人', public: '公开', private: '仅自己' }

export default function Write({ user }) {
  const { openLoginModal } = useLoginModal()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [visGroups, setVisGroups] = useState(['partner'])
  const [visModalOpen, setVisModalOpen] = useState(false)
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()
  const textareaRef = useRef()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      openLoginModal('写日记需要登录', () => navigate('/login'))
    }
  }, [user])

  // 输入框随内容自动撑高（至少占屏高的 35%）
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const min = Math.round(window.innerHeight * 0.35)
    ta.style.height = Math.max(ta.scrollHeight, min) + 'px'
  }, [content])

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const data = await api.uploadImage(file)
      setImages(prev => [...prev, data.url])
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // 群组勾选：多选；选中后自动取消独占项
  const toggleGroup = (key) => {
    setVisGroups(prev => {
      const base = prev.filter(v => v !== 'public' && v !== 'private')
      if (base.includes(key)) {
        const next = base.filter(v => v !== key)
        return next.length === 0 ? base : next // 至少保留一个群组
      }
      return [...base, key]
    })
  }

  // 独占项：公开 / 仅自己
  const selectExclusive = (key) => {
    setVisGroups([key])
  }

  const visSummary = visGroups
    .slice()
    .sort((a, b) => ['partner', 'friend', 'family', 'public', 'private'].indexOf(a) - ['partner', 'friend', 'family', 'public', 'private'].indexOf(b))
    .map(k => labelOf[k])
    .join('、')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) return setError('日记内容不能为空')
    setLoading(true)
    setError('')
    try {
      await api.createDiary({ title, content, visibility: visGroups, images })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 bg-[#F5F5F0] p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-text-main">写日记</h1>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-5 py-2 bg-primary text-white rounded-full text-sm font-medium disabled:opacity-50"
        >
          {loading ? '发布中' : '发布'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 space-y-4">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="标题（可选）"
          className="w-full text-lg font-medium placeholder:text-stone-300 border-b border-stone-100 pb-3 focus:outline-none"
        />

        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="今天发生了什么？"
          className="w-full resize-none text-sm leading-relaxed placeholder:text-stone-300 focus:outline-none overflow-hidden"
        />

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((url, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-stone-100">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full text-xs flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || images.length >= 9}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-primary flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {uploading ? '上传中' : '添加图片'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          <button
            onClick={() => setVisModalOpen(true)}
            className="flex items-center gap-1 min-w-0 text-xs text-primary bg-primary-light rounded-full px-3 py-1.5"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="truncate">可查看范围：{visSummary}</span>
          </button>
        </div>
      </div>

      {visModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setVisModalOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl p-5 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
            <h3 className="text-base font-semibold text-text-main mb-1">可查看群组范围</h3>
            <p className="text-xs text-text-sub mb-4">群组可多选，选中的几类人都能看到这篇日记</p>

            <div className="space-y-2 mb-4">
              {groupOptions.map(opt => {
                const checked = visGroups.includes(opt.key)
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggleGroup(opt.key)}
                    className={"w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm " + (checked ? 'border-primary bg-primary-light text-primary' : 'border-stone-200 text-text-main')}
                  >
                    <span>{opt.label}</span>
                    <span className={"w-5 h-5 rounded-full border flex items-center justify-center " + (checked ? 'bg-primary border-primary' : 'border-stone-300')}>
                      {checked && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="border-t border-stone-100 pt-3 space-y-2">
              {exclusiveOptions.map(opt => {
                const checked = visGroups.includes(opt.key)
                return (
                  <button
                    key={opt.key}
                    onClick={() => selectExclusive(opt.key)}
                    className={"w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm " + (checked ? 'border-primary bg-primary-light text-primary' : 'border-stone-200 text-text-main')}
                  >
                    <span>{opt.label}<span className="text-xs text-text-sub ml-1.5">{opt.desc}</span></span>
                    <span className={"w-5 h-5 rounded-full border flex items-center justify-center " + (checked ? 'bg-primary border-primary' : 'border-stone-300')}>
                      {checked && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setVisModalOpen(false)}
              className="w-full mt-5 py-3 bg-primary text-white rounded-xl text-sm font-medium"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
