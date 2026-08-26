import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api',
  timeout: 30000,
})

api.interceptors.request.use(config => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null
      if (!refreshToken) {
        if (typeof window !== 'undefined') window.location.href = '/login'
        return Promise.reject(error)
      }
      if (isRefreshing) {
        return new Promise(resolve => {
          refreshQueue.push((token: string) => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          })
        })
      }
      isRefreshing = true
      try {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api'}/auth/refresh`,
          { refresh_token: refreshToken },
        )
        const { access_token, refresh_token } = res.data
        localStorage.setItem('token', access_token)
        localStorage.setItem('refreshToken', refresh_token)
        const { useAuthStore } = await import('@/store/auth.store')
        useAuthStore.getState().updateToken(access_token)
        refreshQueue.forEach(cb => cb(access_token))
        refreshQueue = []
        original.headers.Authorization = `Bearer ${access_token}`
        return api(original)
      } catch (refreshError: any) {
        // Only wipe the session if the server explicitly rejected the refresh token
        // (401 / 403). A network error (server down / restarting) should NOT log
        // the user out — their refresh token is still valid and will work once the
        // server comes back up.
        const isTokenRejected = refreshError?.response?.status === 401 || refreshError?.response?.status === 403
        if (isTokenRejected) {
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          const { useAuthStore } = await import('@/store/auth.store')
          useAuthStore.getState().logout()
          if (typeof window !== 'undefined') window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  },
)

export const auth = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post('/auth/register', { name, email, password }),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
}

export const documents = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  list: () => api.get('/documents'),
  get: (id: string) => api.get(`/documents/${id}`),
  delete: (id: string) => api.delete(`/documents/${id}`),
}

export const users = {
  getMe: () => api.get('/users/me'),
  updateMe: (data: { name?: string; preferredLanguage?: string }) => api.patch('/users/me', data),
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/users/me/password', { currentPassword, newPassword }),
}

export const analysis = {
  retranslate: (analysisId: string, language: string) =>
    api.post(`/analysis/${analysisId}/retranslate`, { language }),
  getTranslations: (analysisId: string) =>
    api.get(`/analysis/${analysisId}/translations`),
  deleteTranslation: (analysisId: string, language: string) =>
    api.delete(`/analysis/${analysisId}/translations/${encodeURIComponent(language)}`),
  reanalyze: (analysisId: string, language?: string) =>
    api.post(`/analysis/${analysisId}/reanalyze`, { language }),
  getRevisions: (analysisId: string) =>
    api.get(`/analysis/${analysisId}/revisions`),
  restoreRevision: (analysisId: string, revisionId: string) =>
    api.post(`/analysis/${analysisId}/revisions/${revisionId}/restore`),
  chatUrl: (analysisId: string) =>
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002/api'}/analysis/${analysisId}/chat`,
}

export const tags = {
  list: () => api.get('/tags'),
  create: (name: string, color?: string) => api.post('/tags', { name, color }),
  update: (id: string, data: { name?: string; color?: string }) => api.patch(`/tags/${id}`, data),
  delete: (id: string) => api.delete(`/tags/${id}`),
  getDocumentTags: (documentId: string) => api.get(`/tags/document/${documentId}`),
  setDocumentTags: (documentId: string, tagIds: string[]) => api.put(`/tags/document/${documentId}`, { tagIds }),
}

export const actionItems = {
  complete: (id: string) => api.patch(`/action-items/${id}/complete`),
  uncomplete: (id: string) => api.patch(`/action-items/${id}/uncomplete`),
  delete: (id: string) => api.delete(`/action-items/${id}`),
  create: (dto: { analysisResultId: string; title: string; description: string; deadline?: string | null; priority: string; category: string }) =>
    api.post('/action-items', dto),
  update: (id: string, dto: { title?: string; description?: string; deadline?: string | null; priority?: string; category?: string }) =>
    api.patch(`/action-items/${id}`, dto),
  updateDeadline: (id: string, deadline: string | null) =>
    api.patch(`/action-items/${id}/deadline`, { deadline }),
}

export const calendarEvents = {
  list: (start: string, end: string) => api.get(`/calendar-events?start=${start}&end=${end}`),
  create: (dto: { title: string; description?: string; date: string; color?: string }) => api.post('/calendar-events', dto),
  update: (id: string, dto: { title?: string; description?: string; date?: string; color?: string }) => api.patch(`/calendar-events/${id}`, dto),
  remove: (id: string) => api.delete(`/calendar-events/${id}`),
}

export default api
