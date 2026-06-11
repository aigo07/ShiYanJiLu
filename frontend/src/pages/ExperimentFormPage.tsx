import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, apiGet, apiPatch, apiPost } from '../lib/api'
import type { Experiment, ProcessType } from '../lib/types'

function nowIso() {
  return new Date().toISOString()
}

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

export function ExperimentFormPage() {
  const nav = useNavigate()
  const { id } = useParams()
  const experimentId = id ? Number(id) : null
  const isEdit = experimentId != null && Number.isFinite(experimentId)

  const [processTypes, setProcessTypes] = useState<ProcessType[]>([])
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>(['其它'])
  const [modelSuggestions, setModelSuggestions] = useState<string[]>(['其它'])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [customer, setCustomer] = useState('')
  const [projectNo, setProjectNo] = useState('')
  const [model, setModel] = useState('')
  const [goal, setGoal] = useState('')
  const [processTypeId, setProcessTypeId] = useState<string>('')
  const [startAt, setStartAt] = useState(nowIso())
  const [endAt, setEndAt] = useState('')
  const [note, setNote] = useState('')

  const knownCustomers = useMemo(() => new Set(customerSuggestions.map((s) => s.trim()).filter(Boolean)), [customerSuggestions])
  const knownModels = useMemo(() => new Set(modelSuggestions.map((s) => s.trim()).filter(Boolean)), [modelSuggestions])

  useEffect(() => {
    setErr(null)
    setSuccess(null)
    setLoading(true)
    ;(async () => {
      try {
        const [pts, sugg] = await Promise.all([
          apiGet<ProcessType[]>('/process-types'),
          apiGet<{ customers: string[]; silicone_models: string[] }>('/experiment-suggestions?limit=200'),
        ])
        setProcessTypes(pts)
        setCustomerSuggestions((sugg.customers?.length ? sugg.customers : ['其它']).filter(Boolean))
        setModelSuggestions((sugg.silicone_models?.length ? sugg.silicone_models : ['其它']).filter(Boolean))
        if (isEdit) {
          const exp = await apiGet<Experiment>(`/experiments/${experimentId}`)
          setCustomer(exp.customer_name)
          setProjectNo(exp.project_no)
          setModel(exp.silicone_model)
          setGoal(exp.debug_goal)
          setProcessTypeId(exp.process_type_id ? String(exp.process_type_id) : '')
          setStartAt(exp.start_at)
          // treat end_at equal to start_at as empty for display is too opinionated; show actual
          setEndAt(exp.end_at ?? '')
          setNote(exp.note ?? '')
        } else {
          setCustomer('')
          setProjectNo('')
          setModel('')
          setGoal('')
          setProcessTypeId('')
          setStartAt(nowIso())
          setEndAt('')
          setNote('')
        }
      } catch (e) {
        setErr(humanizeApiError(e, '加载'))
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setSuccess(null)
    if (!customer.trim() || !projectNo.trim() || !model.trim() || !startAt.trim() || !processTypeId) {
      setErr('请填写必填项：客户、项目号、胶型号、工艺类型、开始时间。')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        customer_name: customer.trim(),
        project_no: projectNo.trim(),
        silicone_model: model.trim(),
        debug_goal: goal.trim() === '' ? null : goal.trim(),
        process_type_id: Number(processTypeId),
        start_at: startAt.trim(),
        // end_at semantics: only meaningful when status == 已结束 (status is managed elsewhere)
        end_at: endAt.trim() === '' ? null : endAt.trim(),
        note: note.trim() === '' ? null : note.trim(),
      }
      if (isEdit) {
        const updated = await apiPatch<Experiment>(`/experiments/${experimentId}`, payload)
        setSuccess('保存成功')
        setTimeout(() => setSuccess(null), 1500)
        nav(`/experiments/${updated.id}`)
      } else {
        const created = await apiPost<Experiment>('/experiments', payload)
        nav(`/experiments/${created.id}`)
      }
    } catch (e) {
      setErr(humanizeApiError(e, '保存'))
    } finally {
      setSaving(false)
    }
  }

  const breadcrumbs = (
    <div className="breadcrumbs">
      <Link to="/experiments">实验</Link>
      <span className="breadcrumbSep">/</span>
      <span>{isEdit ? `编辑实验 #${experimentId}` : '新建实验'}</span>
    </div>
  )

  const customerTrim = customer.trim()
  const modelTrim = model.trim()
  const isNewCustomer = customerTrim !== '' && customerTrim !== '其它' && !knownCustomers.has(customerTrim)
  const isNewModel = modelTrim !== '' && modelTrim !== '其它' && !knownModels.has(modelTrim)

  return (
    <div className="containerNarrow">
      {breadcrumbs}
      <div className="pageHeader">
        <div className="pageTitle">{isEdit ? `编辑实验 #${experimentId}` : '新建实验'}</div>
        <div className="toolbar">
          <Link className="btn" to="/experiments">
            ← 返回实验列表
          </Link>
          <button className="btn btnPrimary" type="submit" form="experimentForm" disabled={saving}>
            {saving ? '保存中…' : '保存'}
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
            <form id="experimentForm" onSubmit={onSubmit}>
              <div className="fieldRow">
                <div className="field">
                  <div className="label">客户 *</div>
                  <input className="input" list="customerSuggestions" value={customer} onChange={(e) => setCustomer(e.target.value)} />
                  <datalist id="customerSuggestions">
                    {customerSuggestions.map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                  {isNewCustomer ? <div style={{ marginTop: 6, color: '#92400e', fontSize: 12 }}>提示：这是新的客户（将作为新项保存）</div> : null}
                </div>
                <div className="field">
                  <div className="label">项目号 *</div>
                  <input className="input" value={projectNo} onChange={(e) => setProjectNo(e.target.value)} />
                </div>
              </div>

              <div className="fieldRow" style={{ marginTop: 12 }}>
                <div className="field">
                  <div className="label">胶型号 *</div>
                  <input className="input" list="modelSuggestions" value={model} onChange={(e) => setModel(e.target.value)} />
                  <datalist id="modelSuggestions">
                    {modelSuggestions.map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                  {isNewModel ? <div style={{ marginTop: 6, color: '#92400e', fontSize: 12 }}>提示：这是新的硅胶型号（将作为新项保存）</div> : null}
                </div>
                <div className="field">
                  <div className="label">工艺类型 *</div>
                  <select className="select" value={processTypeId} onChange={(e) => setProcessTypeId(e.target.value)}>
                    <option value="">请选择…</option>
                    {processTypes.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <div className="label">调试目标（可选）</div>
                <textarea className="textarea" rows={4} value={goal} onChange={(e) => setGoal(e.target.value)} />
              </div>

              <div className="fieldRow" style={{ marginTop: 12 }}>
                <div className="field">
                  <div className="label">开始时间（ISO） *</div>
                  <input className="input" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                </div>
                <div className="field">
                  <div className="label">结束时间（可选，ISO）</div>
                  <input className="input" value={endAt} onChange={(e) => setEndAt(e.target.value)} placeholder="留空则默认等于开始时间" />
                </div>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <div className="label">备注（可选）</div>
                <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              <div style={{ marginTop: 12, color: '#525252', fontSize: 12 }}>
                说明：结束时间留空时，系统会自动使用开始时间。
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

