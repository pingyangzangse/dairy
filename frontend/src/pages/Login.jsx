import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { discoverWallets, requestAccount, signMessage, createWalletConnectProvider } from '../lib/wallet'

export default function Login({ onLogin }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('password') // password | code | register | wallet
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [nickName, setNickName] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [wallets, setWallets] = useState([])
  const [wcLoading, setWcLoading] = useState(false)
  const busyRef = useRef(false)

  useEffect(() => {
    if (mode !== 'wallet') return
    let mounted = true
    discoverWallets().then(list => {
      if (mounted) setWallets(list)
    })
    return () => { mounted = false }
  }, [mode])

  const finishLogin = (data) => {
    onLogin(data)
    navigate('/', { replace: true })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busyRef.current) return
    busyRef.current = true
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      let data
      if (mode === 'password') {
        data = await api.login(identifier, password)
      } else if (mode === 'code') {
        data = await api.loginByCode(identifier, code)
      } else {
        data = await api.register(identifier, password, nickName)
      }
      finishLogin(data)
    } catch (err) {
      setError(err.message)
    } finally {
      busyRef.current = false
      setLoading(false)
    }
  }

  const handleSendCode = async () => {
    if (!identifier) return setError('请输入邮箱')
    if (busyRef.current) return
    busyRef.current = true
    setSending(true)
    setError('')
    try {
      await api.sendCode(identifier)
      setSuccess('验证码已发送，请查收邮件')
    } catch (err) {
      setError(err.message)
    } finally {
      busyRef.current = false
      setSending(false)
    }
  }

  const handleWalletPlugin = async (provider) => {
    setError('')
    setLoading(true)
    try {
      const address = await requestAccount(provider)
      const { challenge_id, message } = await api.walletChallenge(address)
      const signature = await signMessage(provider, address, message)
      const data = await api.walletVerify({ challenge_id, address, signature })
      finishLogin(data)
    } catch (err) {
      if (err?.code === 4001) return setError('你取消了签名')
      setError(err.message || '钱包登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleWalletQr = async () => {
    setError('')
    setWcLoading(true)
    try {
      const provider = await createWalletConnectProvider()
      await provider.enable()
      const accounts = provider.accounts || []
      const address = accounts[0]
      if (!address) throw new Error('未能获取钱包地址')
      const { challenge_id, message } = await api.walletChallenge(address)
      const signature = await signMessage(provider, address, message)
      const data = await api.walletVerify({ challenge_id, address, signature })
      finishLogin(data)
    } catch (err) {
      if (err?.message?.includes('rejected') || err?.code === 5000) return setError('你取消了连接')
      setError(err.message || '扫码登录失败')
    } finally {
      setWcLoading(false)
    }
  }

  const tabs = [
    { key: 'password', label: '密码登录' },
    { key: 'code', label: '验证码' },
    { key: 'wallet', label: '钱包' },
    { key: 'register', label: '注册' },
  ]

  return (
    <div className="min-h-screen bg-surface flex flex-col px-6 py-10">
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-primary mb-2">日记</h1>
          <p className="text-sm text-text-sub">记录每一天，分享给重要的人</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <div className="flex gap-2 mb-6 flex-wrap">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setMode(tab.key); setError('') }}
                className={"flex-1 min-w-[4rem] py-2 text-sm rounded-lg transition-colors " + (mode === tab.key ? 'bg-primary text-white' : 'bg-stone-100 text-text-sub')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode !== 'wallet' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-text-sub mb-1">邮箱</label>
                <input
                  type="email"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:outline-none text-sm"
                  placeholder="请输入邮箱"
                  required
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-sm text-text-sub mb-1">昵称</label>
                  <input
                    type="text"
                    value={nickName}
                    onChange={e => setNickName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:outline-none text-sm"
                    placeholder="怎么称呼你"
                  />
                </div>
              )}

              {(mode === 'password' || mode === 'register') && (
                <div>
                  <label className="block text-sm text-text-sub mb-1">密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:outline-none text-sm"
                    placeholder="至少 6 位"
                    required
                  />
                </div>
              )}

              {mode === 'code' && (
                <div>
                  <label className="block text-sm text-text-sub mb-1">验证码</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:outline-none text-sm"
                      placeholder="6 位数字"
                      maxLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={sending}
                      className="px-4 py-2 bg-primary-light text-primary rounded-xl text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                    >
                      {sending ? '发送中' : '获取验证码'}
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}
              {success && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-xl">{success}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-white rounded-xl font-medium text-sm disabled:opacity-50"
              >
                {loading ? '请稍候...' : (mode === 'register' ? '注册' : '登录')}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {error && <p className="text-sm text-red-500">{error}</p>}

              <div>
                <p className="text-sm text-text-sub mb-3">浏览器插件钱包</p>
                {wallets.length === 0 ? (
                  <p className="text-sm text-text-sub bg-stone-50 rounded-xl p-4 text-center">未检测到钱包插件</p>
                ) : (
                  <div className="space-y-2">
                    {wallets.map((w, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleWalletPlugin(w.provider)}
                        disabled={loading}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-stone-50 rounded-xl border border-stone-100 disabled:opacity-50"
                      >
                        {w.info.icon ? (
                          <img src={w.info.icon} alt="" className="w-8 h-8 rounded-md object-contain" />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-primary-light flex items-center justify-center text-primary text-xs font-bold">W</div>
                        )}
                        <span className="text-sm font-medium text-text-main">{w.info.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-100"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-2 text-xs text-text-sub">或</span>
                </div>
              </div>

              <button
                onClick={handleWalletQr}
                disabled={wcLoading || loading}
                className="w-full py-3 bg-white border border-primary text-primary rounded-xl font-medium text-sm disabled:opacity-50"
              >
                {wcLoading ? '请打开手机钱包扫码' : '手机钱包扫码登录'}
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => navigate('/')}
        className="mt-6 text-center text-sm text-text-sub hover:text-primary"
      >
        先逛逛，不登录
      </button>
    </div>
  )
}
