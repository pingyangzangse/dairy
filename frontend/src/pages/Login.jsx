import { useState } from 'react'
import { api } from '../lib/api'

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('password') // password | code | register
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [nickName, setNickName] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
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
      onLogin(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async () => {
    if (!identifier) return setError('请输入邮箱')
    setSending(true)
    setError('')
    try {
      await api.sendCode(identifier)
      alert('验证码已发送')
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col px-6 py-12">
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-primary mb-2">日记</h1>
          <p className="text-sm text-text-sub">记录每一天，分享给重要的人</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
          <div className="flex gap-2 mb-6">
            {[
              { key: 'password', label: '密码登录' },
              { key: 'code', label: '验证码' },
              { key: 'register', label: '注册' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setMode(tab.key); setError('') }}
                className={"flex-1 py-2 text-sm rounded-lg transition-colors " + (mode === tab.key ? 'bg-primary text-white' : 'bg-stone-100 text-text-sub')}
              >
                {tab.label}
              </button>
            ))}
          </div>

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
                    className="flex-1 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:outline-none text-sm"
                    placeholder="6 位数字"
                    maxLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sending}
                    className="px-4 py-2 bg-primary-light text-primary rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    {sending ? '发送中' : '获取验证码'}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-white rounded-xl font-medium text-sm disabled:opacity-50"
            >
              {loading ? '请稍候...' : (mode === 'register' ? '注册' : '登录')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
