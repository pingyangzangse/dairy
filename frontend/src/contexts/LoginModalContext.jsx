import { createContext, useContext, useState, useCallback } from 'react'

const LoginModalContext = createContext(null)

export function LoginModalProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const [onConfirm, setOnConfirm] = useState(null)
  const [message, setMessage] = useState('')

  const openLoginModal = useCallback((customMessage, confirmCallback) => {
    setMessage(customMessage || '该功能需要登录后才能使用')
    setOnConfirm(() => confirmCallback || null)
    setIsOpen(true)
  }, [])

  const closeLoginModal = useCallback(() => {
    setIsOpen(false)
    setOnConfirm(null)
  }, [])

  const confirm = useCallback(() => {
    if (onConfirm) onConfirm()
    closeLoginModal()
  }, [onConfirm, closeLoginModal])

  return (
    <LoginModalContext.Provider value={{ isOpen, openLoginModal, closeLoginModal, confirm, message }}>
      {children}
    </LoginModalContext.Provider>
  )
}

export function useLoginModal() {
  const ctx = useContext(LoginModalContext)
  if (!ctx) throw new Error('useLoginModal must be used within LoginModalProvider')
  return ctx
}
