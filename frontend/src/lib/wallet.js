// 浏览器钱包插件发现（EIP-6963）与签名工具
// 参考 DeepTalk 项目 web/src/utils/wallet.js

// 监听 6963 公告 250ms，window.ethereum 兜底（老钱包不发公告）
export function discoverWallets() {
  return new Promise((resolve) => {
    const found = []
    function onAnnounce(e) {
      if (e.detail && e.detail.provider && e.detail.info) found.push(e.detail)
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce)
      if (!found.length && window.ethereum) {
        found.push({ info: { name: '浏览器钱包', icon: '' }, provider: window.ethereum })
      }
      resolve(found)
    }, 250)
  })
}

// 请求连接并返回第一个账号地址（只弹连接授权，不签名）
export async function requestAccount(provider) {
  const accounts = await provider.request({ method: 'eth_requestAccounts' })
  if (!accounts || !accounts.length) throw new Error('钱包没有可用账号')
  return accounts[0]
}

// 对挑战消息做 personal_sign（UTF-8 -> hex）；用户拒签时 error.code === 4001
export async function signMessage(provider, address, message) {
  const hex = '0x' + Array.from(new TextEncoder().encode(message))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
  return provider.request({ method: 'personal_sign', params: [hex, address] })
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ])
}

function closeWcModal() {
  // WalletConnect 的二维码弹层是 wcm-modal 自定义元素；超时后主动移除，避免遮罩残留
  document.querySelector('wcm-modal')?.remove()
}

// 手机钱包扫码连接（WalletConnect v2）：懒加载 SDK，init+enable 整体超时控制
// relay.walletconnect.org 在部分网络环境下不可达，SDK 默认无限挂起，这里必须兜底
export async function connectWalletConnect(timeoutMs = 25000) {
  const projectId = import.meta.env.VITE_WC_PROJECT_ID || '54686c4d1e721a3a2e98256e662509a1'
  const { EthereumProvider } = await import('@walletconnect/ethereum-provider')
  const initPromise = EthereumProvider.init({
    projectId,
    chains: [1],
    showQrModal: true,
    metadata: {
      name: '日记',
      description: '情侣日记',
      url: typeof window !== 'undefined' ? window.location.origin : '',
      icons: []
    }
  })
  let provider
  try {
    provider = await withTimeout(initPromise, timeoutMs, 'WC_INIT_TIMEOUT')
    await withTimeout(provider.enable(), timeoutMs, 'WC_CONNECT_TIMEOUT')
  } catch (err) {
    closeWcModal()
    try { await provider?.disconnect() } catch {}
    if (err.message === 'WC_INIT_TIMEOUT' || err.message === 'WC_CONNECT_TIMEOUT') {
      throw new Error('连接钱包服务超时：当前网络可能无法访问 WalletConnect，请切换网络（或开代理）后重试；也可以用浏览器插件钱包')
    }
    throw err
  }
  const address = provider.accounts?.[0]
  if (!address) {
    closeWcModal()
    throw new Error('未能获取钱包地址')
  }
  return { provider, address }
}

// 统一钱包登录流程：先发现/连接钱包，再请求后端 challenge，最后签名验证
export async function runWalletLoginFlow({
  provider,
  requestAccount: requestAccountFn,
  walletChallenge,
  walletVerify
}) {
  const address = await requestAccountFn(provider)
  if (!address) throw new Error('未能获取钱包地址')

  const { challenge_id, message } = await walletChallenge(address)
  const signature = await signMessage(provider, address, message)

  const result = await walletVerify({ challenge_id, address, signature })
  return { ...result, address }
}
