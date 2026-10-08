// Web Push 订阅管理：开启/关闭浏览器推送
import { api } from './api'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getPushState() {
  if (!pushSupported()) return { supported: false, enabled: false, reason: 'unsupported' }
  if (Notification.permission === 'denied') return { supported: true, enabled: false, reason: 'denied' }
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return { supported: true, enabled: !!sub, reason: sub ? 'on' : 'off' }
  } catch {
    return { supported: true, enabled: false, reason: 'off' }
  }
}

// 开启推送：请求权限 → subscribe → 上报后端
export async function enablePush() {
  if (!pushSupported()) throw new Error('当前浏览器不支持推送通知')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('通知权限被拒绝，请在浏览器设置中允许通知')
  const { key } = await api.getPushKey()
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  })
  await api.subscribePush(sub.toJSON())
  return sub
}

// 关闭推送：注销订阅 + 通知后端删除
export async function disablePush() {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await api.unsubscribePush(sub.endpoint).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
}
