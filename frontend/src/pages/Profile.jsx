import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoginModal } from '../contexts/LoginModalContext'
import { requestAccount, signMessage, discoverWallets, connectWalletConnect } from '../lib/wallet'

export default function Profile({ user, onLogout }) {
  const navigate = useNavigate()
  const { openLoginModal } = useLoginModal()
  const [profile, setProfile] = useState(user)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  useEffect(() => {
    if (!user) {
      openLoginModal('该功能需要登录后才能使用', () => navigate('/login'))
      return
    }
    loadData()
  }, [user])

  async function loadData() {
    try {
      const data = await api.me()
      setProfile(data)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleWalletLink(provider) {
    setLoading(true)
    setError('')
    try {
      const address = await requestAccount(provider)
      const { challenge_id, message } = await api.walletChallenge(address)
      const signature = await signMessage(provider, address, message)
      await api.walletLink({ challenge_id, address, signature })
      await loadData()
      setNotice('钱包绑定成功')
    } catch (err) {
      setError(err.message || '绑定失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleWalletQrLink() {
    setLoading(true)
    setError('')
    try {
      const { provider, address } = await connectWalletConnect()
      const { challenge_id, message } = await api.walletChallenge(address)
      const signature = await signMessage(provider, address, message)
      await api.walletLink({ challenge_id, address, signature })
      await loadData()
      setNotice('钱包绑定成功')
    } catch (err) {
      setError(err.message || '绑定失败')
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
            <div className="flex items-center justify-between bg-stone-50 rounded-xl p-3">
              <span className="text-xs text-text-sub font-mono">{profile.walletAddress}</span>
              <button
                onClick={handleWalletUnlink}
                disabled={loading}
                className={"text-xs px-2 py-1 border rounded-lg disabled:opacity-50 " + (confirmUnlink ? 'text-white bg-red-500 border-red-500' : 'text-red-500 border-red-200')}
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

      <button
        onClick={onLogout}
        className="w-full py-3 bg-white text-red-500 rounded-2xl text-sm font-medium border border-stone-100"
      >
        退出登录
      </button>
    </div>
  )
}
