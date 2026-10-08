import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoginModal } from '../contexts/LoginModalContext'

const typeOptions = [
  { key: 'couple', label: '情侣' },
  { key: 'friend', label: '朋友' },
  { key: 'family', label: '家人' },
]

export default function Bind({ user }) {
  const { openLoginModal } = useLoginModal()
  const [email, setEmail] = useState('')
  const [foundUser, setFoundUser] = useState(null)
  const [type, setType] = useState('couple')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      openLoginModal('伴侣绑定需要登录', () => navigate('/login'))
    }
  }, [user])
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const handleSearch = async () => {
    setError('')
    setFoundUser(null)
    setLoading(true)
    try {
      const data = await api.searchUser(email)
      if (!data.user) return setError('未找到该用户')
      setFoundUser(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBind = async () => {
    setError('')
    setLoading(true)
    try {
      await api.requestRelationship(foundUser.id, type)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] p-4 flex flex-col items-center justify-center text-center">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 w-full">
          <h2 className="text-lg font-semibold text-text-main mb-2">申请已发送</h2>
          <p className="text-sm text-text-sub mb-6">对方同意后，你们就绑定成功啦</p>
          <button onClick={() => navigate('/profile')} className="px-6 py-2 bg-primary text-white rounded-full text-sm font-medium">
            返回我的
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-4">
      <div className="flex items-center mb-4">
        <button onClick={() => navigate(-1)} className="text-sm text-muted">← 返回</button>
        <h1 className="text-xl font-semibold text-text-main ml-4">绑定伴侣</h1>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 mb-4">
        <label className="block text-sm text-text-sub mb-2">输入对方邮箱</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="partner@example.com"
            className="flex-1 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:outline-none text-sm"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            搜索
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {foundUser && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center text-primary font-medium">
              {(user.nick_name || user.username || '?').slice(0, 1)}
            </div>
            <div>
              <div className="font-medium text-text-main">{user.nick_name || user.username}</div>
              <div className="text-xs text-muted">{user.email}</div>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {typeOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setType(opt.key)}
                className={"flex-1 py-2 rounded-xl text-sm " + (type === opt.key ? 'bg-primary text-white' : 'bg-stone-100 text-text-sub')}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleBind}
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-xl font-medium text-sm disabled:opacity-50"
          >
            {loading ? '发送中...' : '发送绑定申请'}
          </button>
        </div>
      )}
    </div>
  )
}
