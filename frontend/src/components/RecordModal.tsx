import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError, apiGet, apiPatch, apiPost } from '../lib/api'
import type { CuringAgent, Experiment, ProcessType, Record as TrialRecord } from '../lib/types'
import { CuringAgentModal } from './CuringAgentModal'

type Props = {
  open: boolean
  onClose: () => void
  experimentId?: number
  mode?: 'create' | 'edit' | 'draft'
  record?: TrialRecord
  onSaved: (result: { experimentId: number; recordId: number }) => void
  onDraftSaved?: (result: { recordId: number; payload: Record<string, unknown> }) => void
}

type ExperimentCreatePayload = {
  customer_name: string
  project_no: string
  debug_goal: string | null
  silicone_model: string
  process_type_id: number | null
  start_at: string
  end_at: string
  note?: string | null
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

function nowIsoLocal() {
  return new Date().toISOString()
}

export function RecordModal(props: Props) {
  const { open, onClose, experimentId: fixedExperimentId, onSaved, mode = 'create', record, onDraftSaved } = props
  const isEdit = mode === 'edit'
  const isDraft = mode === 'draft'
  const isEditLike = isEdit || isDraft

  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // step control
  const [experimentId, setExperimentId] = useState<number | null>(fixedExperimentId ?? null)
  const [showCreateExperiment, setShowCreateExperiment] = useState(false)

  // dictionaries / lists
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [curingAgents, setCuringAgents] = useState<CuringAgent[]>([])
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>(['其它'])
  const [modelSuggestions, setModelSuggestions] = useState<string[]>(['其它'])

  // experiment mini form
  const [expCustomer, setExpCustomer] = useState('')
  const [expProjectNo, setExpProjectNo] = useState('')
  const [expGoal, setExpGoal] = useState('')
  const [expModel, setExpModel] = useState('')
  const [expProcessTypeId, setExpProcessTypeId] = useState<string>('')
  const [expStartAt, setExpStartAt] = useState(nowIsoLocal())
  const [expEndAt, setExpEndAt] = useState('')
  const [expSaving, setExpSaving] = useState(false)

  // record form
  const [aId, setAId] = useState<string>('')
  const [bId, setBId] = useState<string>('')
  const [ra, setRa] = useState<string>('')
  const [rb, setRb] = useState<string>('')
  const [ml, setMl] = useState<string>('')
  const [mh, setMh] = useState<string>('')
  const [t10, setT10] = useState<string>('')
  const [t90, setT90] = useState<string>('')
  const [bubble, setBubble] = useState<string>('0')
  const [note, setNote] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // nested curing agent quick add
  const [caModalOpen, setCaModalOpen] = useState(false)
  const [caTarget, setCaTarget] = useState<'A' | 'B'>('A')

  const experimentById = useMemo(() => {
    const m = new Map<number, Experiment>()
    for (const e of experiments) m.set(e.id, e)
    return m
  }, [experiments])
  const knownCustomers = useMemo(() => new Set(customerSuggestions.map((s) => s.trim()).filter(Boolean)), [customerSuggestions])
  const knownModels = useMemo(() => new Set(modelSuggestions.map((s) => s.trim()).filter(Boolean)), [modelSuggestions])

  useEffect(() => {
    if (!open) return
    setErr(null)
    setSuccess(null)
    setLoading(true)
    setExperimentId((isEditLike ? record?.experiment_id : fixedExperimentId) ?? fixedExperimentId ?? null)
    setShowCreateExperiment(false)
    // defaults for quick experiment creation
    setExpStartAt(nowIsoLocal())
    setExpEndAt('')
    // init record form for edit-like modes (edit/draft)
    if (isEditLike && record) {
      setAId(String(record.curing_agent_a_id))
      setBId(String(record.curing_agent_b_id))
      setRa(String(record.ratio_a_pct))
      setRb(String(record.ratio_b_pct))
      setMl(String(record.ml))
      setMh(String(record.mh))
      setT10(String(record.t10_sec))
      setT90(String(record.t90_sec))
      setBubble(String(record.bubble_grade))
      setNote(record.note ?? '')
    } else if (!isEditLike) {
      setAId('')
      setBId('')
      setRa('')
      setRb('')
      setMl('')
      setMh('')
      setT10('')
      setT90('')
      setBubble('0')
      setNote('')
    }
    ;(async () => {
      try {
        const [pts, cas, exps, sugg] = await Promise.all([
          apiGet<ProcessType[]>('/process-types'),
          apiGet<CuringAgent[]>('/curing-agents?limit=200&offset=0'),
          apiGet<Experiment[]>('/experiments?limit=50&offset=0'),
          apiGet<{ customers: string[]; silicone_models: string[] }>('/experiment-suggestions?limit=200'),
        ])
        setProcessTypes(pts)
        setCuringAgents(cas)
        setExperiments(exps)
        setCustomerSuggestions((sugg.customers?.length ? sugg.customers : ['其它']).filter(Boolean))
        setModelSuggestions((sugg.silicone_models?.length ? sugg.silicone_models : ['其它']).filter(Boolean))
      } catch (e) {
        setErr(humanizeApiError(e, '加载'))
      } finally {
        setLoading(false)
      }
    })()
  }, [open, fixedExperimentId, isEditLike, record])

  const expCustomerTrim = expCustomer.trim()
  const expModelTrim = expModel.trim()
  const expIsNewCustomer = expCustomerTrim !== '' && expCustomerTrim !== '其它' && !knownCustomers.has(expCustomerTrim)
  const expIsNewModel = expModelTrim !== '' && expModelTrim !== '其它' && !knownModels.has(expModelTrim)

  const ratioSum = (Number(ra) || 0) + (Number(rb) || 0)
  const ratioOk = Number.isFinite(ratioSum) && ratioSum < 100 && ra !== '' && rb !== ''

  const recordValid =
    aId !== '' &&
    bId !== '' &&
    ratioOk &&
    ml !== '' &&
    mh !== '' &&
    t10 !== '' &&
    t90 !== '' &&
    bubble !== ''

  async function submitExperimentMini(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setSuccess(null)
    setExpSaving(true)
    try {
      if (!expCustomer.trim() || !expProjectNo.trim() || !expModel.trim() || !expStartAt.trim() || !expProcessTypeId) {
        setErr('请先填写必填项：客户、项目号、胶型号、工艺类型、开始时间。')
        return
      }
      const startAt = expStartAt.trim()
      const endAt = expEndAt.trim() || startAt
      const payload: ExperimentCreatePayload = {
        customer_name: expCustomer.trim(),
        project_no: expProjectNo.trim(),
        debug_goal: expGoal.trim() === '' ? null : expGoal.trim(),
        silicone_model: expModel.trim(),
        process_type_id: Number(expProcessTypeId),
        start_at: startAt,
        end_at: endAt,
      }
      const created = await apiPost<Experiment>('/experiments', payload)
      setExperiments((xs) => [created, ...xs])
      setExperimentId(created.id)
      setShowCreateExperiment(false)
      setSuccess('实验已创建，可以继续录入记录。')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e) {
      setErr(humanizeApiError(e, '创建实验'))
    } finally {
      setExpSaving(false)
    }
  }

  async function submitRecord(e: FormEvent) {
    e.preventDefault()
    if (experimentId == null) {
      setErr('请先选择或创建实验，再保存记录。')
      setShowCreateExperiment(false)
      return
    }
    if (!recordValid) {
      setErr('请先填写必填项：实验、硫化剂A/B、比例A/B、ML、MH、T10（秒）、T90（秒）。并确保比例 A+B < 100。')
      return
    }
    setErr(null)
    setSuccess(null)
    setSaving(true)
    try {
      const payload = {
        experiment_id: experimentId,
        curing_agent_a_id: Number(aId),
        curing_agent_b_id: Number(bId),
        ratio_a_pct: Number(ra),
        ratio_b_pct: Number(rb),
        ml: Number(ml),
        mh: Number(mh),
        t10_sec: Number(t10),
        t90_sec: Number(t90),
        bubble_grade: Number(bubble),
        note: note.trim() === '' ? null : note.trim(),
      }
      if (isDraft) {
        if (!record) {
          setErr('缺少要编辑的记录。')
          return
        }
        if (!onDraftSaved) {
          setErr('缺少草稿保存回调。')
          return
        }
        onDraftSaved({ recordId: record.id, payload })
        onClose()
        return
      }
      if (isEdit) {
        if (!record) {
          setErr('缺少要编辑的记录。')
          return
        }
        const updated = await apiPatch<TrialRecord>(`/records/${record.id}`, payload)
        setSuccess('保存成功')
        setTimeout(() => setSuccess(null), 1500)
        onSaved({ experimentId: experimentId!, recordId: updated.id })
        onClose()
      } else {
        const created = await apiPost<TrialRecord>('/records', payload)
        setSuccess('保存成功')
        setTimeout(() => setSuccess(null), 1500)
        onSaved({ experimentId: experimentId!, recordId: created.id })
        onClose()
      }
    } catch (e) {
      setErr(humanizeApiError(e, '保存记录'))
    } finally {
      setSaving(false)
    }
  }

  function openQuickAdd(target: 'A' | 'B') {
    setCaTarget(target)
    setCaModalOpen(true)
  }

  function onCuringAgentCreated(ca: CuringAgent) {
    setCuringAgents((xs) => [ca, ...xs])
    if (caTarget === 'A') setAId(String(ca.id))
    else setBId(String(ca.id))
  }

  if (!open) return null

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">
            {isDraft ? `编辑记录（草稿） #${record?.id ?? ''}` : isEdit ? `编辑记录 #${record?.id ?? ''}` : '新增记录'}
          </div>
          <button className="btn" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="modalBody">
          {err ? <div className="errorBar">{err}</div> : null}
          {success ? <div className="successBar">{success}</div> : null}

          {loading ? (
            <div>加载中…</div>
          ) : (
            <>
              {!isEdit && !isDraft && experimentId == null ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 650, marginBottom: 8 }}>先选择或创建实验</div>
                  {!showCreateExperiment ? (
                    <>
                      <div className="fieldRow">
                        <div className="field">
                          <div className="label">选择实验</div>
                          <select className="select" value={experimentId ?? ''} onChange={(e) => setExperimentId(Number(e.target.value) || null)}>
                            <option value="">请选择…</option>
                            {experiments.map((x) => (
                              <option key={x.id} value={String(x.id)}>
                                #{x.id} {x.customer_name} / {x.project_no} / {x.silicone_model}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <div className="label">操作</div>
                          <button className="btn btnPrimary" type="button" onClick={() => setShowCreateExperiment(true)}>
                            新建实验
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, color: '#525252', fontSize: 12 }}>提示：这里先列出最近 50 条实验（后续可加搜索）。</div>
                    </>
                  ) : (
                    <form onSubmit={submitExperimentMini}>
                      <div className="fieldRow">
                        <div className="field">
                          <div className="label">客户</div>
                          <input className="input" list="recordModalCustomerSuggestions" value={expCustomer} onChange={(e) => setExpCustomer(e.target.value)} />
                          <datalist id="recordModalCustomerSuggestions">
                            {customerSuggestions.map((x) => (
                              <option key={x} value={x} />
                            ))}
                          </datalist>
                          {expIsNewCustomer ? (
                            <div style={{ marginTop: 6, color: '#92400e', fontSize: 12 }}>提示：这是新的客户（将作为新项保存）</div>
                          ) : null}
                        </div>
                        <div className="field">
                          <div className="label">项目号</div>
                          <input className="input" value={expProjectNo} onChange={(e) => setExpProjectNo(e.target.value)} />
                        </div>
                      </div>
                      <div className="fieldRow" style={{ marginTop: 12 }}>
                        <div className="field">
                          <div className="label">胶型号</div>
                          <input className="input" list="recordModalModelSuggestions" value={expModel} onChange={(e) => setExpModel(e.target.value)} />
                          <datalist id="recordModalModelSuggestions">
                            {modelSuggestions.map((x) => (
                              <option key={x} value={x} />
                            ))}
                          </datalist>
                          {expIsNewModel ? (
                            <div style={{ marginTop: 6, color: '#92400e', fontSize: 12 }}>提示：这是新的硅胶型号（将作为新项保存）</div>
                          ) : null}
                        </div>
                        <div className="field">
                          <div className="label">工艺类型</div>
                          <select className="select" value={expProcessTypeId} onChange={(e) => setExpProcessTypeId(e.target.value)}>
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
                        <div className="label">调试目标</div>
                        <textarea className="textarea" rows={3} value={expGoal} onChange={(e) => setExpGoal(e.target.value)} />
                      </div>
                      <div className="fieldRow" style={{ marginTop: 12 }}>
                        <div className="field">
                          <div className="label">开始时间（ISO）</div>
                          <input className="input" value={expStartAt} onChange={(e) => setExpStartAt(e.target.value)} />
                        </div>
                        <div className="field">
                          <div className="label">结束时间（可选，ISO）</div>
                          <input className="input" value={expEndAt} onChange={(e) => setExpEndAt(e.target.value)} placeholder="留空则默认等于开始时间" />
                        </div>
                      </div>
                      <div style={{ marginTop: 8, color: '#525252', fontSize: 12 }}>
                        提示：结束时间留空时，系统会自动使用开始时间。
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                        <button className="btn" type="button" onClick={() => setShowCreateExperiment(false)}>
                          返回选择
                        </button>
                        <button
                          className="btn btnPrimary"
                          type="submit"
                          disabled={expSaving}
                        >
                          {expSaving ? '创建中…' : '创建实验'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : null}

              <form onSubmit={submitRecord}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <div style={{ fontWeight: 650 }}>{isEdit ? '编辑记录' : '填写记录'}</div>
                  {experimentId != null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="pill">
                        当前实验：
                        {(() => {
                          const ex = experimentById.get(experimentId)
                          if (!ex) return `#${experimentId}`
                          return `#${ex.id} ${ex.customer_name} / ${ex.project_no} / ${ex.silicone_model}`
                        })()}
                      </div>
                      {!isEdit && !isDraft && !fixedExperimentId ? (
                        <button
                          className="btn"
                          type="button"
                          onClick={() => {
                            setExperimentId(null)
                            setShowCreateExperiment(false)
                            setSuccess(null)
                            setErr(null)
                          }}
                        >
                          更换实验
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="fieldRow">
                  <div className="field">
                    <div className="label">硫化剂A</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select className="select" value={aId} onChange={(e) => setAId(e.target.value)}>
                        <option value="">请选择…</option>
                        {curingAgents.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button className="btn" type="button" onClick={() => openQuickAdd('A')}>
                        新增
                      </button>
                    </div>
                  </div>
                  <div className="field">
                    <div className="label">硫化剂B</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select className="select" value={bId} onChange={(e) => setBId(e.target.value)}>
                        <option value="">请选择…</option>
                        {curingAgents.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button className="btn" type="button" onClick={() => openQuickAdd('B')}>
                        新增
                      </button>
                    </div>
                  </div>
                </div>

                <div className="fieldRow" style={{ marginTop: 12 }}>
                  <div className="field">
                    <div className="label">A 比例（%）</div>
                    <input className="input" value={ra} onChange={(e) => setRa(e.target.value)} placeholder="例如：10" />
                  </div>
                  <div className="field">
                    <div className="label">B 比例（%）</div>
                    <input className="input" value={rb} onChange={(e) => setRb(e.target.value)} placeholder="例如：10" />
                  </div>
                </div>
                {!ratioOk && (ra !== '' || rb !== '') ? (
                  <div style={{ marginTop: 8, color: '#7f1d1d', fontSize: 13 }}>比例要求：A+B 必须小于 100。</div>
                ) : null}

                <div className="fieldRow" style={{ marginTop: 12 }}>
                  <div className="field">
                    <div className="label">ML</div>
                    <input className="input" value={ml} onChange={(e) => setMl(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">MH</div>
                    <input className="input" value={mh} onChange={(e) => setMh(e.target.value)} />
                  </div>
                </div>
                <div className="fieldRow" style={{ marginTop: 12 }}>
                  <div className="field">
                    <div className="label">T10（秒）</div>
                    <input className="input" value={t10} onChange={(e) => setT10(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">T90（秒）</div>
                    <input className="input" value={t90} onChange={(e) => setT90(e.target.value)} />
                  </div>
                </div>
                <div className="fieldRow" style={{ marginTop: 12 }}>
                  <div className="field">
                    <div className="label">气泡等级（0-5）</div>
                    <input className="input" value={bubble} onChange={(e) => setBubble(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">备注（可选）</div>
                    <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn" type="button" onClick={onClose}>
                    取消
                  </button>
                  <button className="btn btnPrimary" type="submit" disabled={!recordValid || saving}>
                    {saving ? '保存中…' : '保存记录'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      <CuringAgentModal
        open={caModalOpen}
        onClose={() => setCaModalOpen(false)}
        onCreated={(ca) => {
          setCaModalOpen(false)
          onCuringAgentCreated(ca)
        }}
      />
    </div>
  )
}

