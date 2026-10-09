import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoginModal } from '../contexts/LoginModalContext'
import PageHeader from '../components/PageHeader'
import DiaryCalendar from '../components/DiaryCalendar'
import { pushSupported, getPushState, enablePush, disablePush } from '../lib/push'
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
  const [notifExpanded, setNotifExpanded] = useState(false)
  const [pushState, setPushState] = useState('loading')
  const [emailNotify, setEmailNotify] = useState(true)
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
      setEmailNotify(me.emailNotify !== false)
      setNotifications(notes.notifications || [])
    } catch (err) {
      setError(err.message)
    }
    // 推送状态
    try {
      const st = await getPushState()
      setPushState(st.enabled ? 'on' : st.reason)
    } catch {
      setPushState('off')
    }
  }

  // 点击单条通知：标记已读；评论类跳转对应日记
  async function handleNotificationClick(n) {
    if (!n.is_read) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x))
      api.markNotificationRead(n.id)
        .then(() => window.dispatchEvent(new Event('diary:notifications-read')))
        .catch(() => {})
    }
    if (n.type === 'comment' && n.diary_id) {
      navigate('/diaries/' + n.diary_id)
    }
  }

  // 邮件提醒开关（国内可达的提醒通道）
  async function handleEmailNotifyToggle() {
    const next = !emailNotify
    setEmailNotify(next)
    try {
      await api.updateSettings({ email_notify: next })
      setNotice(next ? '已开启邮件提醒' : '已关闭邮件提醒')
    } catch (err) {
      setEmailNotify(!next)
      setError(err.message)
    }
  }

  // 推送开关
  async function handlePushToggle() {
    setError('')
    try {
      if (pushState === 'on') {
        await disablePush()
        setPushState('off')
        setNotice('已关闭推送通知')
      } else {
        await enablePush()
        setPushState('on')
        setNotice('推送通知已开启，有新消息时手机会收到提醒')
      }
    } catch (err) {
      setError(err.message || '推送设置失败')
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
    <div className="flex-1 bg-surface">
      <PageHeader title="个人中心" />
      <div className="px-4 pb-6">

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
            <p className="text-xs mt-1 flex items-center gap-1">
              <span className="inline-flex items-center gap-0.5 text-secondary font-medium">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l2.9 6.26L21.5 9.3l-4.75 4.4L18 20.5 12 17.27 6 20.5l1.25-6.8L2.5 9.3l6.6-1.04L12 2z" />
                </svg>
                积分 {profile?.points ?? 0}
              </span>
              <span className="text-muted">
                {profile?.earnedToday ? '· 今日已 +1' : '· 写 300 字以上日记，今日 +1'}
              </span>
            </p>
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


      {user && <DiaryCalendar userId={user.id} />}

      <div className="bg-white rounded-2xl border border-stone-100 mb-4 overflow-hidden">
        <button
          onClick={() => setNotifExpanded(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-sm font-medium text-text-main">消息提醒</span>
            {notifications.filter(n => !n.is_read).length > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center">
                {notifications.filter(n => !n.is_read).length > 99 ? '99+' : notifications.filter(n => !n.is_read).length}
              </span>
            )}
          </div>
          <svg
            className={"w-4 h-4 text-text-sub transition-transform " + (notifExpanded ? 'rotate-180' : '')}
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {notifExpanded && (
          <div className="px-5 pb-4 border-t border-stone-100">
            {notifications.length === 0 ? (
              <p className="text-sm text-text-sub text-center py-4">暂无消息</p>
            ) : (
              <div className="space-y-3 pt-3">
                {notifications.map(n => {
                  const content =
                    n.type === 'comment'
                      ? (n.actor_name + ' 评论了你的日记' + (n.excerpt ? '：' + n.excerpt : ''))
                      : n.type === 'relationship_request'
                      ? (n.actor_name + ' 请求与你绑定为「' + (n.excerpt || '') + '」')
                      : n.type === 'relationship_accepted'
                      ? (n.actor_name + ' 同意了你的绑定申请')
                      : (n.actor_name + ' 有新消息')
                  return (
                    <button key={n.id} onClick={() => handleNotificationClick(n)} className="w-full text-left">
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
                          <p className={"text-sm leading-relaxed " + (n.is_read ? 'text-text-sub' : 'text-text-main font-medium')}>{content}</p>
                          <p className="text-xs text-muted mt-0.5">{dayjs(n.created_at).format('MM-DD HH:mm')}</p>
                        </div>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-2" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 mb-4 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-sm font-medium text-text-main">消息推送</p>
            <p className="text-xs text-muted mt-0.5">
              {pushState === 'on'
                ? '已开启：不在页面时也能收到通知'
                : pushState === 'denied'
                ? '通知权限被拒，请在浏览器设置中允许'
                : pushState === 'unsupported'
                ? '当前浏览器不支持（iPhone 需先把本站添加到主屏幕）'
                : '开启后，评论与绑定消息会推送到手机'}
            </p>
          </div>
          <button
            onClick={handlePushToggle}
            disabled={pushState === 'loading' || pushState === 'denied' || pushState === 'unsupported'}
            className={"flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium disabled:opacity-50 " + (pushState === 'on' ? 'bg-stone-100 text-text-sub' : 'bg-primary text-white')}
          >
            {pushState === 'on' ? '关闭' : '开启'}
          </button>
        </div>
        <div className="flex items-center justify-between border-t border-stone-100 mt-3 pt-3">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-sm font-medium text-text-main">邮件提醒</p>
            <p className="text-xs text-muted mt-0.5">评论与绑定消息发到你绑定的邮箱</p>
          </div>
          <button
            onClick={handleEmailNotifyToggle}
            className={"flex-shrink-0 w-11 h-6 rounded-full transition-colors relative " + (emailNotify ? 'bg-primary' : 'bg-stone-200')}
          >
            <span className={"absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform " + (emailNotify ? 'left-[22px]' : 'left-0.5')} />
          </button>
        </div>
      </div>

      <button
        onClick={onLogout}
        className="w-full py-3 bg-white text-red-500 rounded-2xl text-sm font-medium border border-stone-100"
      >
        退出登录
      </button>
      </div>
    </div>
  )
}
