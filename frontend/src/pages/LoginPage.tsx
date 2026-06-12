import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/data'
import { useAuth } from '../lib/auth'

function humanize(e: unknown) {
  if (e instanceof ApiError) {
    const d = e.detail as unknown
    if (typeof d === 'string') return d
    if (d && typeof d === 'object' && 'detail' in d) return String((d as { detail?: unknown }).detail)
    return `登录失败（HTTP ${e.status}）`
  }
  return String(e)
}

export function LoginPage() {
  const nav = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    try {
      await login(email.trim(), password)
      nav('/dashboard', { replace: true })
    } catch (e) {
      setErr(humanize(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="containerNarrow" style={{ paddingTop: 36 }}>
      <div className="card">
        <div className="cardBody">
          <div style={{ fontSize: 18, fontWeight: 750 }}>登录</div>
          <div style={{ marginTop: 6, color: '#525252', fontSize: 13 }}>请输入邮箱和密码。</div>
          {err ? (
            <div className="errorBar" style={{ marginTop: 12 }}>
              {err}
            </div>
          ) : null}
          <form onSubmit={submit} style={{ marginTop: 12 }}>
            <div className="field">
              <div className="label">邮箱</div>
              <input className="input" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <div className="label">密码</div>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button className="btn btnPrimary" type="submit" disabled={saving || !email.trim() || !password}>
                {saving ? '登录中…' : '登录'}
              </button>
            </div>
          </form>
          <div style={{ marginTop: 10, color: '#525252', fontSize: 12 }}>
            提示：首次管理员需在 Supabase Auth 创建用户后，在 profiles 表中设置 admin 角色。
          </div>
        </div>
      </div>
    </div>
  )
}

