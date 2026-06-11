import { useEffect, useMemo, useState } from 'react'
import { ApiError, apiDelete, apiGet, apiPatch } from '../lib/api'
import { getTableDensity, type TableDensity } from '../lib/prefs'
import type { CuringAgent } from '../lib/types'
import { CuringAgentModal } from '../components/CuringAgentModal'

type Material = {
  id: number
  category: string
  name: string
}

type CompositionRow = {
  material_id: string // keep as string for select/input
  mass_pct: string
}

function parseNumOrNull(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function CuringAgentsPage() {
  const [items, setItems] = useState<CuringAgent[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tableDensity] = useState<TableDensity>(() => getTableDensity())

  const [createOpen, setCreateOpen] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<CuringAgent | null>(null)
  const [editName, setEditName] = useState('')
  const [editDefaultRatio, setEditDefaultRatio] = useState<string>('')
  const [editNote, setEditNote] = useState('')
  const [editComposition, setEditComposition] = useState<CompositionRow[]>([{ material_id: '', mass_pct: '' }])

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState<CuringAgent | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)

  function humanizeApiError(e: unknown, action: string): string {
    if (!(e instanceof ApiError)) return `${action}失败：${String(e)}`

    // FastAPI usually returns {detail: "..."} or {detail: [...]}
    const d = e.detail as any
    const rawDetail =
      typeof d === 'string'
        ? d
        : d && typeof d === 'object' && 'detail' in d
          ? (d.detail as unknown)
          : d

    const detailText =
      typeof rawDetail === 'string'
        ? rawDetail
        : Array.isArray(rawDetail)
          ? '输入有误，请检查填写。'
          : rawDetail
            ? JSON.stringify(rawDetail)
            : ''

    // Known mappings
    if (detailText.includes('CuringAgent is referenced by records')) {
      return `${action}失败：该固化剂已被记录引用，不能删除。`
    }
    if (detailText.includes('CuringAgent name already exists')) {
      return `${action}失败：名称已存在，请换一个名称。`
    }
    if (detailText.includes('composition material_id not found')) {
      return `${action}失败：组分中存在不存在的物料，请重新选择。`
    }
    if (detailText.includes('Request failed')) {
      return `${action}失败：请求失败（HTTP ${e.status}）。`
    }

    return `${action}失败：${detailText || `HTTP ${e.status}`}`
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return items
    return items.filter((x) => x.name.toLowerCase().includes(t))
  }, [items, q])

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const [list, mats] = await Promise.all([
        apiGet<CuringAgent[]>('/curing-agents?limit=200&offset=0'),
        apiGet<Material[]>('/materials?limit=200&offset=0'),
      ])
      setItems(list)
      setMaterials(mats)
    } catch (e) {
      setErr(humanizeApiError(e, '加载'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function buildCompositionPayload(rows: CompositionRow[]): Array<{ material_id: number; mass_pct: number }> | null {
    // Return null if all empty; otherwise validate strictly.
    const cleaned = rows
      .map((r) => ({ material_id: parseNumOrNull(r.material_id), mass_pct: parseNumOrNull(r.mass_pct) }))
      .filter((r) => r.material_id !== null || r.mass_pct !== null)

    if (cleaned.length === 0) return null

    // Require all filled
    for (const r of cleaned) {
      if (r.material_id === null || r.mass_pct === null) throw new Error('组分中存在未填写完整的行')
      if (r.mass_pct < 0 || r.mass_pct > 100) throw new Error('组分百分比必须在 0-100 之间')
    }

    // Unique material_id
    const ids = cleaned.map((r) => r.material_id as number)
    const uniq = new Set(ids)
    if (uniq.size !== ids.length) throw new Error('组分中存在重复物料')

    const sum = cleaned.reduce((acc, r) => acc + (r.mass_pct as number), 0)
    if (Math.abs(sum - 100) > 1e-6) throw new Error(`组分百分比合计必须为 100（当前：${round1(sum)}）`)

    return cleaned.map((r) => ({ material_id: r.material_id as number, mass_pct: r.mass_pct as number }))
  }


  function openEdit(x: CuringAgent) {
    setEditing(x)
    setEditName(x.name)
    setEditDefaultRatio(x.default_ratio == null ? '' : String(x.default_ratio))
    setEditNote(x.note ?? '')
    const rows =
      x.composition && x.composition.length
        ? x.composition.map((c) => ({ material_id: String(c.material_id), mass_pct: String(c.mass_pct) }))
        : [{ material_id: '', mass_pct: '' }]
    setEditComposition(rows)
    setEditOpen(true)
  }

  async function submitEdit() {
    if (!editing) return
    setErr(null)
    setSuccess(null)
    setEditSaving(true)
    try {
      const payload: Record<string, unknown> = {}
      if (editName.trim() !== '') payload.name = editName.trim()
      payload.default_ratio = editDefaultRatio.trim() === '' ? null : Number(editDefaultRatio)
      payload.note = editNote.trim() === '' ? null : editNote.trim()
      payload.composition = buildCompositionPayload(editComposition)
      const updated = await apiPatch<CuringAgent>(`/curing-agents/${editing.id}`, payload)
      setItems((xs) => xs.map((x) => (x.id === updated.id ? updated : x)))
      setEditOpen(false)
      setEditing(null)
      setSuccess('保存成功')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e) {
      setErr(humanizeApiError(e, '保存'))
    } finally {
      setEditSaving(false)
    }
  }

  const editCompSum = useMemo(() => {
    const nums = editComposition.map((r) => parseNumOrNull(r.mass_pct)).filter((x): x is number => x !== null)
    return nums.reduce((a, b) => a + b, 0)
  }, [editComposition])

  const editCompValid = useMemo(() => {
    try {
      buildCompositionPayload(editComposition)
      return true
    } catch {
      return false
    }
  }, [editComposition])

  function openDelete(x: CuringAgent) {
    setDeleting(x)
    setDeleteErr(null)
    setDeleteOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    setErr(null)
    setSuccess(null)
    setDeleteErr(null)
    setDeleteSaving(true)
    try {
      await apiDelete(`/curing-agents/${deleting.id}`)
      setItems((xs) => xs.filter((x) => x.id !== deleting.id))
      setDeleteOpen(false)
      setDeleting(null)
      setSuccess('删除成功')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e) {
      // Show a friendly message in the dialog (and keep it open)
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
        <div className="pageTitle">固化剂</div>
        <div className="toolbar">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索名称…" style={{ width: 240 }} />
          <button className="btn" type="button" onClick={load} disabled={loading}>
            刷新
          </button>
          <button className="btn btnPrimary" type="button" onClick={() => setCreateOpen(true)}>
            新增固化剂
          </button>
        </div>
      </div>

      {err ? <div className="errorBar">请求失败：{err}</div> : null}
      {success ? <div className="successBar">{success}</div> : null}

      <div className="card">
        <div className="cardBody">
          <div style={{ fontWeight: 650, marginBottom: 10 }}>列表</div>
          {loading ? (
            <div>加载中…</div>
          ) : (
            <div className="tableWrap">
              <table className={tableDensity === 'compact' ? 'table tableCompact' : 'table'}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>名称</th>
                    <th>默认比例（%）</th>
                    <th>备注</th>
                    <th>组分</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((x) => (
                    <tr key={x.id}>
                      <td>{x.id}</td>
                      <td>{x.name}</td>
                      <td>{x.default_ratio ?? '-'}</td>
                      <td title={x.note ?? ''} style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {x.note ?? ''}
                      </td>
                      <td>{x.composition?.length ? `${x.composition.length}项` : '-'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="linkBtn" type="button" onClick={() => openEdit(x)}>
                          编辑
                        </button>
                        <span style={{ margin: '0 8px', color: '#a3a3a3' }}>|</span>
                        <button className="linkBtn" type="button" onClick={() => openDelete(x)}>
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ color: '#525252', padding: 14 }}>
                        {q.trim() ? '没有匹配的固化剂。' : '暂无固化剂。点击右上角“新增固化剂”。'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <CuringAgentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(ca) => {
          setItems((xs) => [ca, ...xs])
          setCreateOpen(false)
          setSuccess('保存成功')
          setTimeout(() => setSuccess(null), 2000)
        }}
      />

      {editOpen ? (
        <div className="modalOverlay" onMouseDown={() => setEditOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">编辑固化剂</div>
              <button className="btn" type="button" onClick={() => setEditOpen(false)}>
                关闭
              </button>
            </div>
            <div className="modalBody">
              {editing?.used_record_count ? (
                <div className="errorBar" style={{ marginBottom: 12 }}>
                  提示：该固化剂已被 <b>{editing.used_record_count}</b> 条实验记录使用。修改后会影响历史记录的显示。
                </div>
              ) : null}
              <div className="fieldRow">
                <div className="field">
                  <div className="label">名称</div>
                  <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="field">
                  <div className="label">默认比例（单位：%）</div>
                  <input className="input" value={editDefaultRatio} onChange={(e) => setEditDefaultRatio(e.target.value)} />
                </div>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <div className="label">备注</div>
                <textarea className="textarea" rows={4} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <div className="label">组分（质量百分比，合计必须为 100%）</div>
                <div style={{ border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
                  <table className="table" style={{ borderBottom: 'none' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '60%' }}>物料</th>
                        <th style={{ width: '25%' }}>百分比（%）</th>
                        <th style={{ width: '15%' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editComposition.map((r, idx) => (
                        <tr key={idx}>
                          <td>
                            <select
                              className="select"
                              value={r.material_id}
                              onChange={(e) =>
                                setEditComposition((xs) =>
                                  xs.map((x, i) => (i === idx ? { ...x, material_id: e.target.value } : x))
                                )
                              }
                            >
                              <option value="">请选择物料…</option>
                              {materials.map((m) => (
                                <option key={m.id} value={String(m.id)}>
                                  {m.category} / {m.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="input"
                              value={r.mass_pct}
                              onChange={(e) =>
                                setEditComposition((xs) =>
                                  xs.map((x, i) => (i === idx ? { ...x, mass_pct: e.target.value } : x))
                                )
                              }
                              placeholder="例如：50"
                            />
                          </td>
                          <td>
                            <button
                              className="linkBtn"
                              type="button"
                              onClick={() => setEditComposition((xs) => xs.filter((_, i) => i !== idx))}
                              disabled={editComposition.length <= 1}
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} style={{ padding: 10 }}>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => setEditComposition((xs) => [...xs, { material_id: '', mass_pct: '' }])}
                          >
                            添加组分
                          </button>
                          <span style={{ marginLeft: 12, color: '#525252', fontSize: 13 }}>
                            合计：<b>{round1(editCompSum)}%</b>
                          </span>
                          {!editCompValid ? (
                            <span style={{ marginLeft: 12, color: '#7f1d1d', fontSize: 13 }}>请确保每行完整且合计=100%</span>
                          ) : null}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ marginTop: 10, color: '#525252', fontSize: 12 }}>
                说明：清空“默认比例/状态/备注”会覆盖为“空值”（覆盖旧值）。
              </div>
            </div>
            <div className="modalFooter">
              <button className="btn" type="button" onClick={() => setEditOpen(false)}>
                取消
              </button>
              <button className="btn btnPrimary" type="button" disabled={!editName.trim() || !editCompValid} onClick={submitEdit}>
                {editSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="modalOverlay" onMouseDown={() => setDeleteOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">删除固化剂</div>
              <button className="btn" type="button" onClick={() => setDeleteOpen(false)}>
                关闭
              </button>
            </div>
            <div className="modalBody">
              你确定要删除 <b>{deleting?.name}</b> 吗？如果它已被实验记录引用，系统会拒绝删除。
              {deleteErr ? (
                <div style={{ marginTop: 12 }} className="errorBar">
                  {deleteErr}
                </div>
              ) : null}
            </div>
            <div className="modalFooter">
              <button className="btn" type="button" onClick={() => setDeleteOpen(false)}>
                取消
              </button>
              <button className="btn btnDanger" type="button" onClick={confirmDelete} disabled={deleteSaving}>
                {deleteSaving ? '删除中…' : '删除'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

