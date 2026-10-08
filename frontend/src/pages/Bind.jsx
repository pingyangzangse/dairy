import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoginModal } from '../contexts/LoginModalContext'
import PageHeader from '../components/PageHeader'

const typeOptions = [
  { key: 'couple', label: '情侣' },
  { key: 'friend', label: '朋友' },
  { key: 'family', label: '家人' },
]
const typeLabel = { couple: '情侣', friend: '朋友', family: '家人' }

function Avatar({ name, avatar, size = 'w-12 h-12' }) {
  if (avatar) return <img src={avatar} alt="" className={size + ' rounded-full object-cover'} />
  return (
    <div className={size + ' rounded-full bg-primary-light flex items-center justify-center text-primary font-medium'}>
      {(name || '?').slice(0, 1)}
    </div>
  )
}

export default function Bind({ user }) {
  const { openLoginModal } = useLoginModal()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [foundUser, setFoundUser] = useState(null)
  const [type, setType] = useState('couple')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [success, setSuccess] = useState(false)
  const [relationships, setRelationships] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [confirmUnbind, setConfirmUnbind] = useState(null)

  const loadData = useCallback(async () => {
    try {
      const [rel, sent, incoming] = await Promise.all([
        api.getRelationship().catch(() => ({ relationships: [] })),
        api.getSentRequests().catch(() => ({ requests: [] })),
        api.getPendingRequests().catch(() => ({ requests: [] })),
      ])
      setRelationships(rel.relationships || [])
      setSentRequests(sent.requests || [])
      setIncomingRequests(incoming.requests || [])
    } catch (err) {
      // 静默失败，页面仍可操作
    }
  }, [])

  useEffect(() => {
    if (!user) {
      openLoginModal('伴侣绑定需要登录', () => navigate('/login'))
      return
    }
    loadData()
  }, [user, loadData])

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
      setFoundUser(null)
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRespond = async (requestId, action) => {
    setError('')
    setLoading(true)
    try {
      await api.respondRequest(requestId, action)
      setNotice(action === 'accept' ? '已同意绑定' : '已拒绝申请')
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUnbind = async (id) => {
    if (confirmUnbind !== id) {
      setConfirmUnbind(id)
      setTimeout(() => setConfirmUnbind(null), 3000)
      return
    }
    setConfirmUnbind(null)
    setLoading(true)
    try {
      await api.unbindRelationship(id)
      setNotice('已解除绑定')
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-dvh bg-[#F5F5F0] p-4 flex flex-col items-center justify-center text-center">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 w-full">
          <h2 className="text-lg font-semibold text-text-main mb-2">申请已发送</h2>
          <p className="text-sm text-text-sub mb-6">对方同意后，你们就绑定成功啦</p>
          <button onClick={() => setSuccess(false)} className="px-6 py-2 bg-primary text-white rounded-full text-sm font-medium">
            查看申请状态
          </button>
        </div>
      </div>
    )
  }

  const couple = relationships.filter(r => r.type === 'couple')
  const friends = relationships.filter(r => r.type === 'friend')
  const families = relationships.filter(r => r.type === 'family')
  const availableTypes = typeOptions.filter(t => t.key !== 'couple' || couple.length === 0)

  const renderRelationGroup = (title, list) => {
    if (list.length === 0) return null
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 mb-4">
        <p className="text-xs text-text-sub mb-3">{title}</p>
        <div className="space-y-3">
          {list.map(rel => {
            const name = rel.nick_name || rel.username || '对方'
            return (
              <div key={rel.id} className="flex items-center gap-3">
                <Avatar name={name} avatar={rel.avatar} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-main truncate">{name}</div>
                  <div className="text-xs text-muted">{typeLabel[rel.type] || rel.type}</div>
                </div>
                <button
                  onClick={() => handleUnbind(rel.id)}
                  disabled={loading}
                  className={"flex-shrink-0 text-xs px-3 py-1.5 rounded-full border disabled:opacity-50 whitespace-nowrap " + (confirmUnbind === rel.id ? 'bg-red-500 text-white border-red-500' : 'text-red-500 border-red-200')}
                >
                  {confirmUnbind === rel.id ? '再点一次确认' : '解除绑定'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#F5F5F0]">
      <PageHeader title="绑定伴侣" />
      <div className="px-4">

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
      {notice && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-xl mb-4">{notice}</p>}

      {renderRelationGroup('伴侣', couple)}
      {renderRelationGroup('朋友', friends)}
      {renderRelationGroup('家人', families)}

      {incomingRequests.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 mb-4">
          <p className="text-xs text-text-sub mb-3">收到的申请</p>
          <div className="space-y-3">
            {incomingRequests.map(req => {
              const name = req.nick_name || req.username || '有人'
              return (
                <div key={req.id} className="flex items-center gap-3">
                  <Avatar name={name} avatar={req.avatar} size="w-10 h-10" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-main">{name}</div>
                    <div className="text-xs text-muted">请求与你绑定为「{typeLabel[req.type] || req.type}」</div>
                  </div>
                  <button
                    onClick={() => handleRespond(req.id, 'accept')}
                    disabled={loading}
                    className="flex-shrink-0 px-3 py-1.5 bg-primary text-white rounded-full text-xs disabled:opacity-50"
                  >
                    同意
                  </button>
                  <button
                    onClick={() => handleRespond(req.id, 'reject')}
                    disabled={loading}
                    className="flex-shrink-0 px-3 py-1.5 bg-stone-100 text-text-sub rounded-full text-xs disabled:opacity-50"
                  >
                    拒绝
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {sentRequests.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 mb-4">
          <p className="text-xs text-text-sub mb-3">已发送申请</p>
          <div className="space-y-3">
            {sentRequests.map(req => {
              const name = req.nick_name || req.username || '对方'
              return (
                <div key={req.id} className="flex items-center gap-3">
                  <Avatar name={name} avatar={req.avatar} size="w-10 h-10" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-main">{name}</div>
                    <div className="text-xs text-muted">申请绑定为「{typeLabel[req.type] || req.type}」</div>
                  </div>
                  <span className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">等待对方同意</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {couple.length === 0 && (
        <>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 mb-4">
            <label className="block text-sm text-text-sub mb-2">输入对方邮箱</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="partner@example.com"
                className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:outline-none text-sm"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="flex-shrink-0 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                搜索
              </button>
            </div>
          </div>

          {foundUser && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={foundUser.nickName || foundUser.nick_name || foundUser.username} avatar={foundUser.avatar} />
                <div className="min-w-0">
                  <div className="font-medium text-text-main">{foundUser.nickName || foundUser.nick_name || foundUser.username}</div>
                  <div className="text-xs text-muted break-all">{foundUser.email}</div>
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                {availableTypes.map(opt => (
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
        </>
      )}
      </div>
    </div>
  )
}
