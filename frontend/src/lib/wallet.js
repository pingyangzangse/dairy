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

// 手机钱包扫码登录（WalletConnect v2）：懒加载 SDK，点击时才拉取
// projectId 缺省复用 DeepTalk 项目的 WalletConnect Cloud key，可用 VITE_WC_PROJECT_ID 覆盖
export async function createWalletConnectProvider() {
  const projectId = import.meta.env.VITE_WC_PROJECT_ID || '54686c4d1e721a3a2e98256e662509a1'
  const { EthereumProvider } = await import('@walletconnect/ethereum-provider')
  return EthereumProvider.init({
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
