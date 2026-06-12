import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { ApiError, toApiError } from './data'

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

async function readProfile(authUser: User): Promise<AuthUser> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,display_name,role,is_active')
    .eq('id', authUser.id)
    .single()

  if (error) throw toApiError(error, '加载用户资料失败')
  const profile = data as ProfileRow
  if (!profile.is_active) throw new ApiError('账号已被停用', 403, { detail: '账号已被停用' })

  return {
    id: profile.id,
    email: profile.email || authUser.email || '',
    display_name: profile.display_name,
    role: profile.role,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw toApiError(error, '恢复登录态失败')
      if (!data.user) {
        setUser(null)
        return
      }
      setUser(await readProfile(data.user))
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw toApiError(error, '登录失败')
    if (!data.user) throw new ApiError('登录失败', 401, { detail: '登录失败' })
    setUser(await readProfile(data.user))
  }

  async function logout() {
    try {
      await supabase.auth.signOut()
    } finally {
      setUser(null)
    }
  }

  useEffect(() => {
    void refresh()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null)
        setLoading(false)
        return
      }
      void readProfile(session.user)
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false))
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<Ctx>(() => ({ loading, user, refresh, login, logout }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
