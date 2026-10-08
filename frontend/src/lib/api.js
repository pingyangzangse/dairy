import { compressImage } from './compressImage'

const API_BASE = ''

function getToken() {
  return localStorage.getItem('diary_token')
}

function setToken(token) {
  localStorage.setItem('diary_token', token)
}

function removeToken() {
  localStorage.removeItem('diary_token')
}

async function request(path, options = {}) {
  const url = API_BASE + path
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  const token = getToken()
  if (token) headers.Authorization = 'Bearer ' + token

  const res = await fetch(url, {
    ...options,
    headers,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || '请求失败')
    error.status = res.status
    error.data = data
    throw error
  }
  return data
}

export const api = {
  getToken,
  setToken,
  removeToken,

  // Auth
  login: (identifier, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  register: (identifier, password, nick_name) => request('/api/auth/register', { method: 'POST', body: JSON.stringify({ identifier, password, nick_name }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  sendCode: (email) => request('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ email }) }),
  loginByCode: (email, code) => request('/api/auth/login-by-code', { method: 'POST', body: JSON.stringify({ email, code }) }),

  // Wallet
  walletChallenge: (address) => request('/api/auth/wallet/challenge', { method: 'POST', body: JSON.stringify({ address }) }),
  walletVerify: (body) => request('/api/auth/wallet/verify', { method: 'POST', body: JSON.stringify(body) }),
  walletLink: (body) => request('/api/auth/wallet/link', { method: 'POST', body: JSON.stringify(body) }),
  walletUnlink: () => request('/api/auth/wallet/unlink', { method: 'POST' }),

  // User
  me: () => request('/api/user/me'),
  updateProfile: (body) => request('/api/user/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  searchUser: (email) => request('/api/user/search?email=' + encodeURIComponent(email)),
  getUser: (id) => request('/api/user/' + id),

  // Relationship
  getRelationship: () => request('/api/relationship'),
  requestRelationship: (recipient_id, type) => request('/api/relationship/request', { method: 'POST', body: JSON.stringify({ recipient_id, type }) }),
  getPendingRequests: () => request('/api/relationship/pending'),
  respondRequest: (request_id, action) => request('/api/relationship/respond', { method: 'POST', body: JSON.stringify({ request_id, action }) }),
  unbindRelationship: (relationship_id) => request('/api/relationship/unbind', { method: 'POST', body: JSON.stringify({ relationship_id }) }),

  // Diary
  createDiary: (body) => request('/api/diaries', { method: 'POST', body: JSON.stringify(body) }),
  updateDiary: (id, body) => request('/api/diaries/' + id, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDiary: (id) => request('/api/diaries/' + id, { method: 'DELETE' }),
  getDiary: (id) => request('/api/diaries/' + id),

  // Comments
  getComments: (diaryId) => request('/api/diaries/' + diaryId + '/comments'),
  addComment: (diaryId, content) => request('/api/diaries/' + diaryId + '/comments', { method: 'POST', body: JSON.stringify({ content }) }),
  deleteComment: (id) => request('/api/comments/' + id, { method: 'DELETE' }),

  // Follow
  follow: (userId) => request('/api/follow/' + userId, { method: 'POST' }),
  unfollow: (userId) => request('/api/unfollow/' + userId, { method: 'POST' }),
  isFollowing: (userId) => request('/api/follow/' + userId),

  // Feed
  feed: (mode = 'all', page = 1, pageSize = 10) => request('/api/feed?mode=' + mode + '&page=' + page + '&pageSize=' + pageSize),

  // Diary delete
  deleteDiary: (id) => request('/api/diaries/' + id, { method: 'DELETE' }),

  // Relationship extra
  getSentRequests: () => request('/api/relationship/sent'),

  // Notifications
  getNotifications: () => request('/api/notifications'),
  getUnreadCount: () => request('/api/notifications/unread-count'),
  markNotificationsRead: () => request('/api/notifications/read', { method: 'POST' }),
  markNotificationRead: (id) => request('/api/notifications/' + id + '/read', { method: 'POST' }),

  // Push
  getPushKey: () => request('/api/push/key'),
  subscribePush: (subscription) => request('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) }),
  unsubscribePush: (endpoint) => request('/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }),

  // Upload
  uploadImage: async (file) => {
    const compressed = await compressImage(file)
    const formData = new FormData()
    formData.append('image', compressed)
    const res = await fetch('/api/upload/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + getToken() },
      body: formData,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || (res.status === 413 ? '图片太大，请换一张试试' : '上传失败，请稍后再试'))
    }
    return data
  },
}
