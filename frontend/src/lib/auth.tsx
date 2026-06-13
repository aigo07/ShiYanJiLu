import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { cloudbaseAuth } from './cloudbase'
import { ApiError, toApiError } from './data'
import { apiRequest } from './api'

export type AuthUser = {
  id: string
  email: string
  display_name: string
  role: 'admin' | 'auditor' | 'editor' | 'viewer'
}

type ProfileRow = {
  id: string
  email: string | null
  display_name: string
  role: AuthUser['role']
  is_active: boolean
}

type Ctx = {
  loading: boolean
  user: AuthUser | null
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<Ctx | null>(null)

function toAuthUser(profile: ProfileRow): AuthUser {
  if (!profile.is_active) throw new ApiError('账号已被停用', 403, { detail: '账号已被停用' })
  return {
    id: profile.id,
    email: profile.email || '',
    display_name: profile.display_name,
    role: profile.role,
  }
}

async function readProfile(): Promise<AuthUser> {
  const profile = await apiRequest<ProfileRow>('/me')
  return toAuthUser(profile)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const { data, error } = await cloudbaseAuth.getSession()
      if (error) throw toApiError(error, '恢复登录态失败')
      if (!data.session) {
        setUser(null)
        return
      }
      setUser(await readProfile())
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function login(email: string, password: string) {
    const { data, error } = await cloudbaseAuth.signInWithPassword({ email, password })
    if (error) throw toApiError(error, '登录失败')
    if (!data.user) throw new ApiError('登录失败', 401, { detail: '登录失败' })
    setUser(await readProfile())
  }

  async function logout() {
    try {
      await cloudbaseAuth.signOut()
    } finally {
      setUser(null)
    }
  }

  useEffect(() => {
    void refresh()
    const unsubscribe: unknown = cloudbaseAuth.onAuthStateChange((_event: string, session: unknown) => {
      if (!session) {
        setUser(null)
        setLoading(false)
        return
      }
      void readProfile()
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false))
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  const value = useMemo<Ctx>(() => ({ loading, user, refresh, login, logout }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
