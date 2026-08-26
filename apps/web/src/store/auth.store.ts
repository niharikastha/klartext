import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  name: string
  email: string
  preferredLanguage?: string
  avatarUrl?: string | null
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
  setAuth: (token: string, refreshToken: string, user: AuthUser) => void
  updateToken: (token: string) => void
  updateUser: (user: Partial<AuthUser>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, refreshToken, user) => {
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', refreshToken)
        set({ token, refreshToken, user })
      },
      updateToken: (token) => {
        localStorage.setItem('token', token)
        set({ token })
      },
      updateUser: (partial) => set(state => ({ user: state.user ? { ...state.user, ...partial } : state.user })),
      logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        set({ token: null, refreshToken: null, user: null })
      },
    }),
    { name: 'klartext-auth' },
  ),
)
