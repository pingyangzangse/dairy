import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function Profile({ user, onLogout, onUpdate }) {
  const [relationship, setRelationship] = useState(null)
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [avatarFile, setAvatarFile] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [relData, pendingData] = await Promise.all([
        api.getRelationship(),
        api.getPendingRequests(),
      ])
      setRelationship(relData.relationship)
      setPending(pendingData.requests)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const url = await api.uploadImage(file)
      await api.updateProfile({ avatar: url })
      onUpdate({ ...user, avatar: url })
    } catch (err) {
      alert(err.message)
    }
  }

  const handleRespond = async (requestId, action) => {
    try {
      await api.respondRequest(requestId, action)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-4 pb-24">
      <h1 className="text-xl font-semibold text-text-main mb-4">我的</h1>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 mb-4">
        <div className="flex items-center gap-4">
          <label className="relative w-16 h-16 rounded-full bg-primary-light flex items-center justify-center text-primary text-xl font-medium overflow-hidden cursor-pointer">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              (user?.nickName || user?.username || '?').slice(0, 1)
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
          <div>
            <div className="text-lg font-semibold text-text-main">{user?.nickName || user?.username}</div>
            <div className="text-sm text-muted">{user?.email}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-text-main">亲密关系</h2>
          {!relationship && (
            <Link to="/bind" className="text-sm text-primary font-medium">去绑定</Link>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted">加载中...</p>
        ) : relationship ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-text-sub">
              已绑定：<span className="font-medium text-text-main">{relationship.type === 'couple' ? '情侣' : relationship.type === 'friend' ? '朋友' : '家人'}</span>
            </div>
            <button
              onClick={() => api.unbindRelationship().then(loadData)}
              className="text-xs text-red-400 border border-red-200 px-3 py-1 rounded-full"
            >
              解除
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">还没有绑定关系</p>
        )}

        {pending.length > 0 && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <h3 className="text-sm font-medium text-text-main mb-2">收到申请</h3>
            {pending.map(req => (
              <div key={req.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-text-sub">{req.nick_name || req.username}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleRespond(req.id, 'accept')} className="px-3 py-1 bg-primary text-white rounded-full text-xs">同意</button>
                  <button onClick={() => handleRespond(req.id, 'reject')} className="px-3 py-1 bg-stone-100 text-text-sub rounded-full text-xs">拒绝</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onLogout}
        className="w-full py-3 bg-white text-red-500 rounded-2xl text-sm font-medium border border-stone-100"
      >
        退出登录
      </button>
    </div>
  )
}
