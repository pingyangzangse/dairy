import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoginModal } from '../contexts/LoginModalContext'

const visibilityOptions = [
  { key: 'partner', label: '仅伴侣可见' },
  { key: 'public', label: '公开' },
  { key: 'private', label: '仅自己可见' },
]

export default function Write({ user }) {
  const { openLoginModal } = useLoginModal()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState('partner')
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      openLoginModal('写日记需要登录', () => navigate('/login'))
    }
  }, [user])
  const fileRef = useRef()
  const navigate = useNavigate()

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await api.uploadImage(file)
      setImages(prev => [...prev, url])
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) return setError('日记内容不能为空')
    setLoading(true)
    setError('')
    try {
      await api.createDiary({ title, content, visibility, images })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-4">
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
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="今天发生了什么？"
          rows={10}
          className="w-full resize-none text-sm leading-relaxed placeholder:text-stone-300 focus:outline-none"
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

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || images.length >= 9}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-primary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {uploading ? '上传中' : '添加图片'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          <div className="flex gap-2">
            {visibilityOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setVisibility(opt.key)}
                className={"px-3 py-1 rounded-full text-xs " + (visibility === opt.key ? 'bg-primary text-white' : 'bg-stone-100 text-text-sub')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
