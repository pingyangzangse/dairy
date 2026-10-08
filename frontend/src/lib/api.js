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
  unbindRelationship: () => request('/api/relationship/unbind', { method: 'POST' }),

  // Diary
  createDiary: (body) => request('/api/diaries', { method: 'POST', body: JSON.stringify(body) }),
  updateDiary: (id, body) => request('/api/diaries/' + id, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDiary: (id) => request('/api/diaries/' + id, { method: 'DELETE' }),
  getDiary: (id) => request('/api/diaries/' + id),

  // Comments
  getComments: (diaryId) => request('/api/diaries/' + diaryId + '/comments'),
  postComment: (diaryId, content) => request('/api/diaries/' + diaryId + '/comments', { method: 'POST', body: JSON.stringify({ content }) }),
  deleteComment: (id) => request('/api/comments/' + id, { method: 'DELETE' }),

  // Follow
  follow: (userId) => request('/api/follow/' + userId, { method: 'POST' }),
  unfollow: (userId) => request('/api/unfollow/' + userId, { method: 'POST' }),
  isFollowing: (userId) => request('/api/follow/' + userId),

  // Feed
  getFeed: (mode = 'all', page = 1, pageSize = 10) => request('/api/feed?mode=' + mode + '&page=' + page + '&pageSize=' + pageSize),

  // Upload
  uploadImage: async (file) => {
    const formData = new FormData()
    formData.append('image', file)
    const res = await fetch('/api/upload/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + getToken() },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '上传失败')
    return data.url
  },
}
