import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoginModal } from '../contexts/LoginModalContext'
import dayjs from 'dayjs'
import { requestAccount, signMessage, discoverWallets, connectWalletConnect, retryOnNetwork } from '../lib/wallet'

export default function Profile({ user, onLogout }) {
  const navigate = useNavigate()
  const { openLoginModal } = useLoginModal()
  const [profile, setProfile] = useState(user)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [notifications, setNotifications] = useState([])
  const pendingLinkRef = { current: null }

  useEffect(() => {
    if (!user) {
      openLoginModal('该功能需要登录后才能使用', () => navigate('/login'))
      return
    }
    loadData()
  }, [user])

  async function loadData() {
    try {
      const [me, notes] = await Promise.all([
        api.me(),
        api.getNotifications().catch(() => ({ notifications: [] })),
      ])
      setProfile(me)
      setNotifications(notes.notifications || [])
      // 页面展示即视为已读，并通知底部导航刷新红点
      if ((notes.notifications || []).some(n => !n.is_read)) {
        api.markNotificationsRead()
          .then(() => window.dispatchEvent(new Event('diary:notifications-read')))
          .catch(() => {})
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleWalletLink(provider) {
    setLoading(true)
    setError('')
    try {
      let pending = pendingLinkRef.current
      if (!pending) {
        const address = await requestAccount(provider)
        const { challenge_id, message } = await api.walletChallenge(address)
        const signature = await signMessage(provider, address, message)
        pending = { challenge_id, address, signature }
        pendingLinkRef.current = pending
      }
      // 切钱包 App 签名再切回来，网络可能抖动：自动重试 3 次，签名不失效（挑战 5 分钟内有效）
      await retryOnNetwork(() => api.walletLink(pending))
      pendingLinkRef.current = null
      await loadData()
      setNotice('钱包绑定成功')
    } catch (err) {
      if (!err?.status) {
        setError('网络异常：签名已保留，网络恢复后再点一次「绑定」即可完成，无需重新签名')
      } else {
        pendingLinkRef.current = null
        setError(err.message || '绑定失败')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleWalletQrLink() {
    setLoading(true)
    setError('')
    try {
      let pending = pendingLinkRef.current
      if (!pending) {
        const { provider, address } = await connectWalletConnect()
        const { challenge_id, message } = await api.walletChallenge(address)
        const signature = await signMessage(provider, address, message)
        pending = { challenge_id, address, signature }
        pendingLinkRef.current = pending
      }
      await retryOnNetwork(() => api.walletLink(pending))
      pendingLinkRef.current = null
      await loadData()
      setNotice('钱包绑定成功')
    } catch (err) {
      if (!err?.status) {
        setError('网络异常：签名已保留，网络恢复后再点一次「绑定」即可完成，无需重新签名')
      } else {
        pendingLinkRef.current = null
        setError(err.message || '绑定失败')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleWalletUnlink() {
    if (!confirmUnlink) {
      setConfirmUnlink(true)
      setTimeout(() => setConfirmUnlink(false), 3000)
      return
    }
    setConfirmUnlink(false)
    setLoading(true)
    try {
      await api.walletUnlink()
      await loadData()
      setNotice('钱包已解绑，5 秒后自动隐藏')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const { url } = await api.uploadImage(file)
      await api.updateProfile({ avatar: url })
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-surface px-5 py-6">
      <h1 className="text-xl font-semibold text-primary mb-6">个人中心</h1>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
      {notice && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-xl mb-4">{notice}</p>}

      <div className="bg-white rounded-2xl p-5 border border-stone-100 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <img
              src={profile?.avatar || '/default-avatar.png'}
              alt="avatar"
              className="w-16 h-16 rounded-full object-cover bg-stone-100"
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/default-avatar.png' }}
            />
            <label className="absolute bottom-0 right-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-[10px]">
              换
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <div>
            <p className="font-medium text-text-main">{profile?.nickName || profile?.username || '未命名'}</p>
            <p className="text-xs text-text-sub">{profile?.email || '未绑定邮箱'}</p>
          </div>
        </div>

        <div className="border-t border-stone-100 pt-4">
          <p className="text-sm font-medium text-text-main mb-2">钱包绑定</p>
          {profile?.walletAddress ? (
            <div className="flex items-center justify-between gap-2 bg-stone-50 rounded-xl p-3">
              <span className="flex-1 min-w-0 text-xs text-text-sub font-mono truncate" title={profile.walletAddress}>
                {profile.walletAddress.slice(0, 8)}…{profile.walletAddress.slice(-6)}
              </span>
              <button
                onClick={handleWalletUnlink}
                disabled={loading}
                className={"flex-shrink-0 text-xs px-2 py-1 border rounded-lg disabled:opacity-50 whitespace-nowrap " + (confirmUnlink ? 'text-white bg-red-500 border-red-500' : 'text-red-500 border-red-200')}
              >
                {confirmUnlink ? '再点一次确认解绑' : '解绑'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-text-sub">绑定钱包后可通过钱包登录，且与 DeepTalk 账号通用</p>
              <button
                onClick={async () => {
                  const list = await discoverWallets()
                  if (list[0]) await handleWalletLink(list[0].provider)
                  else setError('未检测到钱包插件')
                }}
                disabled={loading}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {loading ? '处理中...' : '绑定浏览器钱包'}
              </button>
              <button
                onClick={handleWalletQrLink}
                disabled={loading}
                className="w-full py-2.5 bg-white border border-primary text-primary rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {loading ? '处理中...' : '手机钱包扫码绑定'}
              </button>
            </div>
          )}
        </div>
      </div>


      {notifications.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-stone-100 mb-4">
          <p className="text-sm font-medium text-text-main mb-3">消息提醒</p>
          <div className="space-y-3">
            {notifications.map(n => {
              const content =
                n.type === 'comment'
                  ? (n.actor_name + ' 评论了你的日记' + (n.excerpt ? '：' + n.excerpt : ''))
                  : n.type === 'relationship_request'
                  ? (n.actor_name + ' 请求与你绑定为「' + (n.excerpt || '') + '」')
                  : n.type === 'relationship_accepted'
                  ? (n.actor_name + ' 同意了你的绑定申请')
                  : (n.actor_name + ' 有新动态')
              const inner = (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary flex-shrink-0">
                    {n.type === 'comment' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4-.8L3 21l1.8-4.2A7.6 7.6 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-main leading-relaxed">{content}</p>
                    <p className="text-xs text-muted mt-0.5">{dayjs(n.created_at).format('MM-DD HH:mm')}</p>
                  </div>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-2" />}
                </div>
              )
              return n.type === 'comment' && n.diary_id ? (
                <button key={n.id} onClick={() => navigate('/diaries/' + n.diary_id)} className="w-full text-left">
                  {inner}
                </button>
              ) : (
                <div key={n.id}>{inner}</div>
              )
            })}
          </div>
        </div>
      )}

      <button
        onClick={onLogout}
        className="w-full py-3 bg-white text-red-500 rounded-2xl text-sm font-medium border border-stone-100"
      >
        退出登录
      </button>
    </div>
  )
}
