import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../lib/api'
import { ConfirmModal } from '../components/ConfirmModal'
import { getTableDensity, type TableDensity } from '../lib/prefs'

type Material = {
  id: number
  category: string
  name: string
  hydrogen_content: number | null
  vinyl_content: number | null
  volatile_min: number | null
  volatile_max: number | null
  avg_mw_wan: number | null
  pt_ppm: number | null
  created_at?: string
  updated_at?: string
}

function fmtNum(v: number | null | undefined) {
  if (v == null) return '-'
  if (!Number.isFinite(v)) return String(v)
  return String(v)
}

function fmtDt(s: string | undefined) {
  if (!s) return '-'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString()
}

export function MaterialsPage() {
  const [items, setItems] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [tableDensity] = useState<TableDensity>(() => getTableDensity())

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)

  const [saving, setSaving] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState<Material | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)

  const [fCategory, setFCategory] = useState('')
  const [fName, setFName] = useState('')
  const [fHydrogen, setFHydrogen] = useState('')
  const [fVinyl, setFVinyl] = useState('')
  const [fVolMin, setFVolMin] = useState('')
  const [fVolMax, setFVolMax] = useState('')
  const [fMw, setFMw] = useState('')
  const [fPt, setFPt] = useState('')

  function humanizeApiError(e: unknown, action: string): string {
    if (!(e instanceof ApiError)) return `${action}失败：${String(e)}`
    const d: any = e.detail
    const rawDetail =
      typeof d === 'string'
        ? d
        : d && typeof d === 'object' && 'detail' in d
          ? (d.detail as unknown)
          : d
    if (Array.isArray(rawDetail)) return `${action}失败：输入有误，请检查填写。`
    if (typeof rawDetail === 'string' && rawDetail) return `${action}失败：${rawDetail}`
    return `${action}失败：HTTP ${e.status}`
  }

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const list = await apiGet<Material[]>('/materials?limit=200&offset=0')
      setItems(list)
    } catch (e) {
      setErr(humanizeApiError(e, '加载'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return items
    return items.filter((x) => (x.category + ' ' + x.name).toLowerCase().includes(t))
  }, [items, q])

  function resetForm() {
    setFCategory('')
    setFName('')
    setFHydrogen('')
    setFVinyl('')
    setFVolMin('')
    setFVolMax('')
    setFMw('')
    setFPt('')
  }

  function openCreate() {
    setErr(null)
    setSuccess(null)
    setEditing(null)
    resetForm()
    setCreateOpen(true)
  }

  function openEdit(m: Material) {
    setErr(null)
    setSuccess(null)
    setEditing(m)
    setFCategory(m.category ?? '')
    setFName(m.name ?? '')
    setFHydrogen(m.hydrogen_content == null ? '' : String(m.hydrogen_content))
    setFVinyl(m.vinyl_content == null ? '' : String(m.vinyl_content))
    setFVolMin(m.volatile_min == null ? '' : String(m.volatile_min))
    setFVolMax(m.volatile_max == null ? '' : String(m.volatile_max))
    setFMw(m.avg_mw_wan == null ? '' : String(m.avg_mw_wan))
    setFPt(m.pt_ppm == null ? '' : String(m.pt_ppm))
    setEditOpen(true)
  }

  function toNumOrNull(s: string): number | null {
    const t = s.trim()
    if (!t) return null
    const n = Number(t)
    if (!Number.isFinite(n)) throw new Error('数值字段请输入数字')
    return n
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setSuccess(null)
    if (!fCategory.trim() || !fName.trim()) {
      setErr('请填写必填项：类别、名称。')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        category: fCategory.trim(),
        name: fName.trim(),
        hydrogen_content: toNumOrNull(fHydrogen),
        vinyl_content: toNumOrNull(fVinyl),
        volatile_min: toNumOrNull(fVolMin),
        volatile_max: toNumOrNull(fVolMax),
        avg_mw_wan: toNumOrNull(fMw),
        pt_ppm: toNumOrNull(fPt),
      }
      const created = await apiPost<Material>('/materials', payload)
      setItems((xs) => [created, ...xs])
      setCreateOpen(false)
      setSuccess('保存成功')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : humanizeApiError(e, '保存'))
    } finally {
      setSaving(false)
    }
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setErr(null)
    setSuccess(null)
    if (!fCategory.trim() || !fName.trim()) {
      setErr('请填写必填项：类别、名称。')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        category: fCategory.trim(),
        name: fName.trim(),
        hydrogen_content: toNumOrNull(fHydrogen),
        vinyl_content: toNumOrNull(fVinyl),
        volatile_min: toNumOrNull(fVolMin),
        volatile_max: toNumOrNull(fVolMax),
        avg_mw_wan: toNumOrNull(fMw),
        pt_ppm: toNumOrNull(fPt),
      }
      const updated = await apiPatch<Material>(`/materials/${editing.id}`, payload)
      setItems((xs) => xs.map((x) => (x.id === updated.id ? updated : x)))
      setEditOpen(false)
      setEditing(null)
      setSuccess('保存成功')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : humanizeApiError(e, '保存'))
    } finally {
      setSaving(false)
    }
  }

  function openDelete(m: Material) {
    setErr(null)
    setSuccess(null)
    setDeleteErr(null)
    setDeleting(m)
    setDeleteOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    setErr(null)
    setSuccess(null)
    setDeleteErr(null)
    setDeleteSaving(true)
    try {
      await apiDelete(`/materials/${deleting.id}`)
      setItems((xs) => xs.filter((x) => x.id !== deleting.id))
      setDeleteOpen(false)
      setDeleting(null)
      setSuccess('删除成功')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e) {
      const msg = humanizeApiError(e, '删除')
      setDeleteErr(msg)
      setErr(msg)
    } finally {
      setDeleteSaving(false)
    }
  }

  return (
    <div>
      <div className="pageHeader">
        <div className="pageTitle">原材料</div>
        <div className="toolbar">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索：类别 / 名称…" style={{ width: 240 }} />
          <button className="btn" type="button" onClick={load} disabled={loading}>
            刷新
          </button>
          <button className="btn btnPrimary" type="button" onClick={openCreate}>
            新增原材料
          </button>
        </div>
      </div>

      {err ? <div className="errorBar">{err}</div> : null}
      {success ? <div className="successBar">{success}</div> : null}

      <div className="card">
        <div className="cardBody">
          {loading ? (
            <div>加载中…</div>
          ) : (
            <div className="tableWrap">
              <table className={tableDensity === 'compact' ? 'table tableCompact' : 'table'}>
                <thead>
                  <tr>
                    <th>类别</th>
                    <th>名称</th>
                    <th>氢含量</th>
                    <th>乙烯基</th>
                    <th>挥发份min</th>
                    <th>挥发份max</th>
                    <th>分子量</th>
                    <th>Pt(ppm)</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id}>
                      <td>{m.category}</td>
                      <td style={{ fontWeight: 650 }}>{m.name}</td>
                      <td>{fmtNum(m.hydrogen_content)}</td>
                      <td>{fmtNum(m.vinyl_content)}</td>
                      <td>{fmtNum(m.volatile_min)}</td>
                      <td>{fmtNum(m.volatile_max)}</td>
                      <td>{fmtNum(m.avg_mw_wan)}</td>
                      <td>{fmtNum(m.pt_ppm)}</td>
                      <td>{fmtDt(m.updated_at)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="linkBtn" type="button" onClick={() => openEdit(m)}>
                          编辑
                        </button>
                        <span style={{ margin: '0 8px', color: '#a3a3a3' }}>|</span>
                        <button className="linkBtn" type="button" onClick={() => openDelete(m)}>
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ color: '#525252', padding: 14 }}>
                        {q.trim() ? '没有匹配的原材料。' : '暂无原材料。点击右上角“新增原材料”。'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createOpen ? (
        <div className="modalOverlay" onMouseDown={() => setCreateOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">新增原材料</div>
              <button className="btn" type="button" onClick={() => setCreateOpen(false)}>
                关闭
              </button>
            </div>
            <div className="modalBody">
              <form onSubmit={submitCreate}>
                <div className="fieldRow">
                  <div className="field">
                    <div className="label">类别 *</div>
                    <input className="input" value={fCategory} onChange={(e) => setFCategory(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">名称 *</div>
                    <input className="input" value={fName} onChange={(e) => setFName(e.target.value)} />
                  </div>
                </div>
                <div className="fieldRow" style={{ marginTop: 12 }}>
                  <div className="field">
                    <div className="label">氢含量</div>
                    <input className="input" value={fHydrogen} onChange={(e) => setFHydrogen(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">乙烯基</div>
                    <input className="input" value={fVinyl} onChange={(e) => setFVinyl(e.target.value)} />
                  </div>
                </div>
                <div className="fieldRow" style={{ marginTop: 12 }}>
                  <div className="field">
                    <div className="label">挥发份min</div>
                    <input className="input" value={fVolMin} onChange={(e) => setFVolMin(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">挥发份max</div>
                    <input className="input" value={fVolMax} onChange={(e) => setFVolMax(e.target.value)} />
                  </div>
                </div>
                <div className="fieldRow" style={{ marginTop: 12 }}>
                  <div className="field">
                    <div className="label">分子量</div>
                    <input className="input" value={fMw} onChange={(e) => setFMw(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">Pt(ppm)</div>
                    <input className="input" value={fPt} onChange={(e) => setFPt(e.target.value)} />
                  </div>
                </div>
                <div className="modalFooter">
                  <button className="btn" type="button" onClick={() => setCreateOpen(false)} disabled={saving}>
                    取消
                  </button>
                  <button className="btn btnPrimary" type="submit" disabled={saving}>
                    {saving ? '保存中…' : '保存'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="modalOverlay" onMouseDown={() => setEditOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">编辑原材料</div>
              <button className="btn" type="button" onClick={() => setEditOpen(false)}>
                关闭
              </button>
            </div>
            <div className="modalBody">
              <form onSubmit={submitEdit}>
                <div className="fieldRow">
                  <div className="field">
                    <div className="label">类别 *</div>
                    <input className="input" value={fCategory} onChange={(e) => setFCategory(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">名称 *</div>
                    <input className="input" value={fName} onChange={(e) => setFName(e.target.value)} />
                  </div>
                </div>
                <div className="fieldRow" style={{ marginTop: 12 }}>
                  <div className="field">
                    <div className="label">氢含量</div>
                    <input className="input" value={fHydrogen} onChange={(e) => setFHydrogen(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">乙烯基</div>
                    <input className="input" value={fVinyl} onChange={(e) => setFVinyl(e.target.value)} />
                  </div>
                </div>
                <div className="fieldRow" style={{ marginTop: 12 }}>
                  <div className="field">
                    <div className="label">挥发份min</div>
                    <input className="input" value={fVolMin} onChange={(e) => setFVolMin(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">挥发份max</div>
                    <input className="input" value={fVolMax} onChange={(e) => setFVolMax(e.target.value)} />
                  </div>
                </div>
                <div className="fieldRow" style={{ marginTop: 12 }}>
                  <div className="field">
                    <div className="label">分子量</div>
                    <input className="input" value={fMw} onChange={(e) => setFMw(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">Pt(ppm)</div>
                    <input className="input" value={fPt} onChange={(e) => setFPt(e.target.value)} />
                  </div>
                </div>
                <div className="modalFooter">
                  <button className="btn" type="button" onClick={() => setEditOpen(false)} disabled={saving}>
                    取消
                  </button>
                  <button className="btn btnPrimary" type="submit" disabled={saving}>
                    {saving ? '保存中…' : '保存'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={deleteOpen}
        title="删除原材料"
        confirmText={deleteSaving ? '删除中…' : '删除'}
        cancelText="取消"
        confirmDanger
        disableConfirm={deleteSaving}
        onCancel={() => {
          setDeleteOpen(false)
          setDeleting(null)
          setDeleteErr(null)
        }}
        onConfirm={() => void confirmDelete()}
      >
        <div>
          你确定要删除 <b>{deleting ? `${deleting.category} / ${deleting.name}` : ''}</b> 吗？删除后不可恢复。
          {deleteErr ? (
            <div style={{ marginTop: 12 }} className="errorBar">
              {deleteErr}
            </div>
          ) : null}
        </div>
      </ConfirmModal>
    </div>
  )
}

