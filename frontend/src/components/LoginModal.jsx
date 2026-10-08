import { useNavigate } from 'react-router-dom'
import { useLoginModal } from '../contexts/LoginModalContext'

export default function LoginModal() {
  const { isOpen, closeLoginModal, message } = useLoginModal()
  const navigate = useNavigate()

  if (!isOpen) return null

  const handleLogin = () => {
    closeLoginModal()
    navigate('/login')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={closeLoginModal}
      />
      <div className="relative w-full max-w-xs bg-white rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text-main mb-2">需要登录</h3>
          <p className="text-sm text-text-sub mb-6 leading-relaxed">{message}</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={closeLoginModal}
              className="flex-1 py-2.5 rounded-full text-sm font-medium text-text-sub bg-stone-100 active:bg-stone-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleLogin}
              className="flex-1 py-2.5 rounded-full text-sm font-medium text-white bg-primary active:bg-primary/90 transition-colors"
            >
              去登录
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
