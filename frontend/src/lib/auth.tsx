import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from './api'
import { setCsrfToken } from './prefs'

export type AuthUser = {
  id: number
  username: string
  display_name: string
  role: 'admin' | 'auditor' | 'editor' | 'viewer'
}

type MeOut = AuthUser & { csrf_token?: string | null }

type Ctx = {
  loading: boolean
  user: AuthUser | null
  refresh: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const me = await apiGet<MeOut>('/auth/me')
      setUser({ id: me.id, username: me.username, display_name: me.display_name, role: me.role })
      setCsrfToken(me.csrf_token ?? null)
    } catch {
      setUser(null)
      setCsrfToken(null)
    } finally {
      setLoading(false)
    }
  }

  async function login(username: string, password: string) {
    const me = await apiPost<MeOut>('/auth/login', { username, password })
    setUser({ id: me.id, username: me.username, display_name: me.display_name, role: me.role })
    setCsrfToken(me.csrf_token ?? null)
  }

  async function logout() {
    try {
      await apiPost('/auth/logout', {})
    } finally {
      setUser(null)
      setCsrfToken(null)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<Ctx>(() => ({ loading, user, refresh, login, logout }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

