import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError, createCuringAgent, listMaterials } from '../lib/data'
import type { CuringAgent, Material } from '../lib/types'

type CompositionRow = { material_id: string; mass_pct: string }

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (ca: CuringAgent) => void
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

function humanizeApiError(e: unknown, action: string): string {
  if (!(e instanceof ApiError)) return `${action}失败：${String(e)}`
  const d = e.detail as unknown
  const rawDetail =
    typeof d === 'string'
      ? d
      : d && typeof d === 'object' && 'detail' in d
        ? (d as { detail?: unknown }).detail
        : d
  if (Array.isArray(rawDetail)) return `${action}失败：输入有误，请检查填写。`
  if (typeof rawDetail === 'string' && rawDetail) return `${action}失败：${rawDetail}`
  return `${action}失败：HTTP ${e.status}`
}

function buildCompositionPayload(rows: CompositionRow[]): Array<{ material_id: number; mass_pct: number }> | null {
  const cleaned = rows
    .map((r) => ({ material_id: parseNumOrNull(r.material_id), mass_pct: parseNumOrNull(r.mass_pct) }))
    .filter((r) => r.material_id !== null || r.mass_pct !== null)
  if (cleaned.length === 0) return null
  for (const r of cleaned) {
    if (r.material_id === null || r.mass_pct === null) throw new Error('组分中存在未填写完整的行')
    if (r.mass_pct < 0 || r.mass_pct > 100) throw new Error('组分百分比必须在 0-100 之间')
  }
  const ids = cleaned.map((r) => r.material_id as number)
  const uniq = new Set(ids)
  if (uniq.size !== ids.length) throw new Error('组分中存在重复物料')
  const sum = cleaned.reduce((acc, r) => acc + (r.mass_pct as number), 0)
  if (Math.abs(sum - 100) > 1e-6) throw new Error(`组分百分比合计必须为 100（当前：${round1(sum)}）`)
  return cleaned.map((r) => ({ material_id: r.material_id as number, mass_pct: r.mass_pct as number }))
}

export function CuringAgentModal(props: Props) {
  const { open, onClose, onCreated } = props

  const [materials, setMaterials] = useState<Material[]>([])
  const [name, setName] = useState('')
  const [defaultRatio, setDefaultRatio] = useState<string>('')
  const [note, setNote] = useState('')
  const [composition, setComposition] = useState<CompositionRow[]>([{ material_id: '', mass_pct: '' }])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErr(null)
    setSaving(false)
    setName('')
    setDefaultRatio('')
    setNote('')
    setComposition([{ material_id: '', mass_pct: '' }])
    ;(async () => {
      try {
        const mats = await listMaterials(200, 0)
        setMaterials(mats)
      } catch (e) {
        setErr(humanizeApiError(e, '加载物料'))
      }
    })()
  }, [open])

  const compSum = useMemo(() => {
    const nums = composition.map((r) => parseNumOrNull(r.mass_pct)).filter((x): x is number => x !== null)
    return nums.reduce((a, b) => a + b, 0)
  }, [composition])

  const compValid = useMemo(() => {
    try {
      buildCompositionPayload(composition)
      return true
    } catch {
      return false
    }
  }, [composition])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { name: name.trim() }
      if (defaultRatio.trim() !== '') payload.default_ratio = Number(defaultRatio)
      if (note.trim() !== '') payload.note = note.trim()
      const comp = buildCompositionPayload(composition)
      if (comp !== null) payload.composition = comp
      const created = await createCuringAgent(payload)
      onCreated(created)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErr(e instanceof ApiError ? humanizeApiError(e, '保存固化剂') : `保存固化剂失败：${msg}`)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">新增固化剂</div>
          <button className="btn" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="modalBody">
          {err ? <div className="errorBar">{err}</div> : null}

          <form onSubmit={onSubmit}>
            <div className="fieldRow">
              <div className="field">
                <div className="label">名称</div>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：6899" />
              </div>
              <div className="field">
                <div className="label">默认比例（可选，单位：%）</div>
                <input className="input" value={defaultRatio} onChange={(e) => setDefaultRatio(e.target.value)} placeholder="例如：1 表示 1%" />
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <div className="label">备注（可选）</div>
              <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
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
                    {composition.map((r, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            className="select"
                            value={r.material_id}
                            onChange={(e) =>
                              setComposition((xs) => xs.map((x, i) => (i === idx ? { ...x, material_id: e.target.value } : x)))
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
                              setComposition((xs) => xs.map((x, i) => (i === idx ? { ...x, mass_pct: e.target.value } : x)))
                            }
                            placeholder="例如：50"
                          />
                        </td>
                        <td>
                          <button
                            className="linkBtn"
                            type="button"
                            onClick={() => setComposition((xs) => xs.filter((_, i) => i !== idx))}
                            disabled={composition.length <= 1}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} style={{ padding: 10 }}>
                        <button className="btn" type="button" onClick={() => setComposition((xs) => [...xs, { material_id: '', mass_pct: '' }])}>
                          添加组分
                        </button>
                        <span style={{ marginLeft: 12, color: '#525252', fontSize: 13 }}>
                          合计：<b>{round1(compSum)}%</b>
                        </span>
                        {!compValid ? (
                          <span style={{ marginLeft: 12, color: '#7f1d1d', fontSize: 13 }}>请确保每行完整且合计=100%</span>
                        ) : null}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modalFooter">
              <button className="btn" type="button" onClick={onClose}>
                取消
              </button>
              <button className="btn btnPrimary" type="submit" disabled={!name.trim() || !compValid || saving}>
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

