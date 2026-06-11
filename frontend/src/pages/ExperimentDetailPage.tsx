import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, apiDelete, apiGet, apiPatch } from '../lib/api'
import type { CuringAgent, Experiment, ProcessType, Record as TrialRecord } from '../lib/types'
import { RecordModal } from '../components/RecordModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { clearSkipExperimentDeleteConfirm, getSkipExperimentDeleteConfirm, setSkipExperimentDeleteConfirm } from '../lib/prefs'

type ExperimentWithRecords = Experiment & { records: TrialRecord[] }

export function ExperimentDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const experimentId = Number(id)

  const [exp, setExp] = useState<ExperimentWithRecords | null>(null)
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([])
  const [curingAgents, setCuringAgents] = useState<CuringAgent[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [recordOpen, setRecordOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<TrialRecord | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmDontAskAgain, setDeleteConfirmDontAskAgain] = useState(false)
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState<boolean>(() => getSkipExperimentDeleteConfirm())
  const [statusSaving, setStatusSaving] = useState(false)
  // record draft applies in batch on “完成”
  const [recordEditMode, setRecordEditMode] = useState(false)
  const [recordApplying, setRecordApplying] = useState(false)
  const [draftFinalRecordId, setDraftFinalRecordId] = useState<number | null | undefined>(undefined)
  const [draftEdits, setDraftEdits] = useState<Record<number, Record<string, unknown>>>({})
  const [draftDeletes, setDraftDeletes] = useState<Record<number, true>>({})
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false)
  const [applyConfirmText, setApplyConfirmText] = useState('')
  const [expEditMode, setExpEditMode] = useState(false)
  const [expSaving, setExpSaving] = useState(false)
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>(['其它'])
  const [modelSuggestions, setModelSuggestions] = useState<string[]>(['其它'])

  // experiment edit form
  const [fCustomer, setFCustomer] = useState('')
  const [fProjectNo, setFProjectNo] = useState('')
  const [fModel, setFModel] = useState('')
  const [fGoal, setFGoal] = useState('')
  const [fStatus, setFStatus] = useState('待开始')
  const [fProcessTypeId, setFProcessTypeId] = useState<string>('')
  const [fStartAt, setFStartAt] = useState('')
  const [fEndAt, setFEndAt] = useState('')
  const [fNote, setFNote] = useState('')

  const ptNameById = useMemo(() => new Map(processTypes.map((p) => [p.id, p.name])), [processTypes])
  const caNameById = useMemo(() => new Map(curingAgents.map((c) => [c.id, c.name])), [curingAgents])
  const knownCustomers = useMemo(() => new Set(customerSuggestions.map((s) => s.trim()).filter(Boolean)), [customerSuggestions])
  const knownModels = useMemo(() => new Set(modelSuggestions.map((s) => s.trim()).filter(Boolean)), [modelSuggestions])
  const effectiveFinalId = useMemo(() => {
    if (draftFinalRecordId !== undefined) return draftFinalRecordId
    return exp?.final_record_id ?? null
  }, [draftFinalRecordId, exp])
  const recordsSorted = useMemo(() => {
    if (!exp) return []
    const xs = [...(exp.records ?? [])]
    xs.sort((a, b) => {
      const af = effectiveFinalId != null && a.id === effectiveFinalId
      const bf = effectiveFinalId != null && b.id === effectiveFinalId
      if (af !== bf) return af ? -1 : 1
      return b.id - a.id
    })
    return xs
  }, [exp, effectiveFinalId])

  async function load() {
    if (!Number.isFinite(experimentId)) return
    setLoading(true)
    setErr(null)
    try {
      const [pts, cas, e, sugg] = await Promise.all([
        apiGet<ProcessType[]>('/process-types'),
        apiGet<CuringAgent[]>('/curing-agents?limit=200&offset=0'),
        apiGet<ExperimentWithRecords>(`/experiments/${experimentId}?include_records=true`),
        apiGet<{ customers: string[]; silicone_models: string[] }>('/experiment-suggestions?limit=200'),
      ])
      setProcessTypes(pts)
      setCuringAgents(cas)
      setExp(e)
      setCustomerSuggestions((sugg.customers?.length ? sugg.customers : ['其它']).filter(Boolean))
      setModelSuggestions((sugg.silicone_models?.length ? sugg.silicone_models : ['其它']).filter(Boolean))
    } catch (e) {
      if (e instanceof ApiError) setErr(JSON.stringify(e.detail ?? e.message))
      else setErr(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentId])
  useEffect(() => {
    setRecordEditMode(false)
    setExpEditMode(false)
    setDraftFinalRecordId(undefined)
    setDraftEdits({})
    setDraftDeletes({})
    setDeleteConfirmOpen(false)
    setDeleteConfirmDontAskAgain(false)
    setApplyConfirmOpen(false)
    setApplyConfirmText('')
  }, [experimentId])
  useEffect(() => {
    if (!exp) return
    setFCustomer(exp.customer_name ?? '')
    setFProjectNo(exp.project_no ?? '')
    setFModel(exp.silicone_model ?? '')
    setFGoal(exp.debug_goal ?? '')
    setFStatus(exp.status ?? '待开始')
    setFProcessTypeId(exp.process_type_id ? String(exp.process_type_id) : '')
    setFStartAt(exp.start_at ?? '')
    setFEndAt(exp.end_at ?? '')
    setFNote(exp.note ?? '')
  }, [exp])

  function setFinalDraft(recordId: number) {
    setDraftFinalRecordId(recordId)
  }

  function clearFinalDraft() {
    setDraftFinalRecordId(null)
  }

  async function performDeleteExperiment() {
    if (!exp) return
    setErr(null)
    setSuccess(null)
    setDeleting(true)
    try {
      await apiDelete(`/experiments/${exp.id}`)
      nav('/experiments')
    } catch (e) {
      if (e instanceof ApiError) setErr(String(e.detail ?? e.message ?? '请求失败'))
      else setErr(String(e))
    } finally {
      setDeleting(false)
    }
  }

  function deleteExperiment() {
    if (!exp) return
    if (skipDeleteConfirm) {
      void performDeleteExperiment()
      return
    }
    setDeleteConfirmDontAskAgain(false)
    setDeleteConfirmOpen(true)
  }

  function toggleDeleteDraft(recordId: number) {
    setDraftDeletes((m: Record<number, true>) => {
      const next = { ...m }
      if (next[recordId]) delete next[recordId]
      else next[recordId] = true
      return next
    })
  }

  function applyDraftSaved(result: { recordId: number; payload: Record<string, unknown> }) {
    setDraftEdits((m: Record<number, Record<string, unknown>>) => ({ ...m, [result.recordId]: result.payload }))
  }

  function discardRecordDrafts() {
    setDraftFinalRecordId(undefined)
    setDraftEdits({})
    setDraftDeletes({})
    setRecordEditMode(false)
    setErr(null)
    setSuccess(null)
  }

  async function performApplyRecordDrafts() {
    if (!exp) return
    setErr(null)
    setSuccess(null)

    const editsIds = Object.keys(draftEdits).map((x) => Number(x)).filter((x) => Number.isFinite(x))
    const deleteIds = Object.keys(draftDeletes).map((x) => Number(x)).filter((x) => Number.isFinite(x))
    const finalChanged = draftFinalRecordId !== undefined

    const effectiveFinalAfter = finalChanged ? draftFinalRecordId : (exp.final_record_id ?? null)
    if (effectiveFinalAfter != null && draftDeletes[effectiveFinalAfter]) {
      setErr('提交失败：你把“最终记录”标记为待删除，请先取消删除或先取消最终记录。')
      return
    }

    if (editsIds.length === 0 && deleteIds.length === 0 && !finalChanged) {
      setSuccess('没有需要提交的修改')
      setTimeout(() => setSuccess(null), 1500)
      return
    }

    setRecordApplying(true)
    try {
      // 1) patch edited records (skip those marked for delete)
      for (const rid of editsIds) {
        if (draftDeletes[rid]) continue
        await apiPatch(`/records/${rid}`, draftEdits[rid])
      }
      // 2) delete records
      for (const rid of deleteIds) {
        await apiDelete(`/records/${rid}`)
      }
      // 3) update final record if changed
      if (finalChanged) {
        await apiPatch(`/experiments/${exp.id}`, { final_record_id: draftFinalRecordId })
      }
      setSuccess('记录修改已提交')
      setTimeout(() => setSuccess(null), 2000)
      setDraftFinalRecordId(undefined)
      setDraftEdits({})
      setDraftDeletes({})
      setRecordEditMode(false)
      await load()
    } catch (e) {
      if (e instanceof ApiError) setErr(String(e.detail ?? e.message ?? '请求失败'))
      else setErr(String(e))
    } finally {
      setRecordApplying(false)
    }
  }

  function applyRecordDrafts() {
    if (!exp) return
    const editsCount = Object.keys(draftEdits).length
    const deleteCount = Object.keys(draftDeletes).length
    const finalChanged = draftFinalRecordId !== undefined
    setApplyConfirmText(
      `确认提交修改吗？\n- 编辑：${editsCount} 条\n- 删除：${deleteCount} 条\n- 最终记录：${finalChanged ? '将变更' : '不变'}`,
    )
    setApplyConfirmOpen(true)
  }

  async function saveExperiment(e: FormEvent) {
    e.preventDefault()
    if (!exp) return
    setErr(null)
    setSuccess(null)
    if (!fCustomer.trim() || !fProjectNo.trim() || !fModel.trim() || !fStartAt.trim() || !fProcessTypeId) {
      setErr('请填写必填项：客户、项目号、胶型号、工艺类型、开始时间。')
      return
    }
    setExpSaving(true)
    try {
      const payload: Record<string, unknown> = {
        customer_name: fCustomer.trim(),
        project_no: fProjectNo.trim(),
        silicone_model: fModel.trim(),
        status: fStatus.trim() || '待开始',
        debug_goal: fGoal.trim() === '' ? null : fGoal.trim(),
        process_type_id: Number(fProcessTypeId),
        start_at: fStartAt.trim(),
        end_at: (fEndAt.trim() || fStartAt.trim()),
        note: fNote.trim() === '' ? null : fNote.trim(),
      }
      await apiPatch(`/experiments/${exp.id}`, payload)
      setSuccess('实验已保存')
      setTimeout(() => setSuccess(null), 2000)
      setExpEditMode(false)
      await load()
    } catch (e) {
      if (e instanceof ApiError) setErr(String(e.detail ?? e.message ?? '请求失败'))
      else setErr(String(e))
    } finally {
      setExpSaving(false)
    }
  }

  async function updateStatus(next: string) {
    if (!exp) return
    const prev = exp.status ?? '待开始'
    if (next === prev) return
    setErr(null)
    setSuccess(null)
    setStatusSaving(true)
    try {
      const endAt = next === '已结束' ? new Date().toISOString() : null
      await apiPatch(`/experiments/${exp.id}`, { status: next, end_at: endAt })
      setExp((x) => (x ? { ...x, status: next, end_at: endAt } : x))
      setSuccess(`状态已更新：${prev} → ${next}`)
      setTimeout(() => setSuccess(null), 2000)
    } catch (e) {
      if (e instanceof ApiError) setErr(String(e.detail ?? e.message ?? '请求失败'))
      else setErr(String(e))
    } finally {
      setStatusSaving(false)
    }
  }

  function cancelExperimentEdit() {
    if (!exp) return
    setFCustomer(exp.customer_name ?? '')
    setFProjectNo(exp.project_no ?? '')
    setFModel(exp.silicone_model ?? '')
    setFGoal(exp.debug_goal ?? '')
    setFStatus(exp.status ?? '待开始')
    setFProcessTypeId(exp.process_type_id ? String(exp.process_type_id) : '')
    setFStartAt(exp.start_at ?? '')
    setFEndAt(exp.end_at ?? '')
    setFNote(exp.note ?? '')
    setExpEditMode(false)
    setErr(null)
    setSuccess(null)
  }

  if (!Number.isFinite(experimentId)) return <div>无效实验 ID</div>

  return (
    <div className="containerWide">
      <div className="breadcrumbs">
        <Link to="/experiments">实验</Link>
        <span className="breadcrumbSep">/</span>
        <span>实验详情 #{experimentId}</span>
      </div>
      <div className="pageHeader">
        <div className="pageTitle">实验详情 #{experimentId}</div>
        <div className="toolbar">
          <Link className="btn" to="/experiments">
            ← 返回实验列表
          </Link>
          <button className="btn btnDanger" onClick={deleteExperiment} disabled={deleting}>
            {deleting ? '删除中…' : '删除'}
          </button>
          {skipDeleteConfirm ? (
            <button
              className="btn"
              type="button"
              onClick={() => {
                clearSkipExperimentDeleteConfirm()
                setSkipDeleteConfirm(false)
                setSuccess('已恢复删除确认提示')
                setTimeout(() => setSuccess(null), 2000)
              }}
              disabled={deleting}
              title="恢复删除确认提示（会再次弹出确认框）"
            >
              恢复删除确认
            </button>
          ) : null}
          <button className="btn btnPrimary" onClick={() => setRecordOpen(true)}>
            新增记录
          </button>
        </div>
      </div>

      {err ? <div className="errorBar">请求失败：{err}</div> : null}
      {success ? <div className="successBar">{success}</div> : null}

      {loading || !exp ? (
        <div className="card">
          <div className="cardBody">加载中…</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="cardBody">
              <div className="metaTitleRow">
                <div className="metaTitle">实验信息</div>
                {!expEditMode ? (
                  <button className="btn" type="button" onClick={() => setExpEditMode(true)}>
                    编辑实验
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" type="button" onClick={cancelExperimentEdit} disabled={expSaving}>
                      取消
                    </button>
                    <button className="btn btnPrimary" type="submit" form="experimentInlineForm" disabled={expSaving}>
                      {expSaving ? '保存中…' : '保存'}
                    </button>
                  </div>
                )}
              </div>

              {!expEditMode ? (
                <>
                  <div className="metaGrid">
                    <div className="metaItem">
                      <div className="metaLabel">客户</div>
                      <div className="metaValue">{exp.customer_name}</div>
                    </div>
                    <div className="metaItem">
                      <div className="metaLabel">项目号</div>
                      <div className="metaValueNormal">{exp.project_no}</div>
                    </div>
                    <div className="metaItem">
                      <div className="metaLabel">胶型号</div>
                      <div className="metaValue">{exp.silicone_model}</div>
                    </div>
                  <div className="metaItem">
                    <div className="metaLabel">状态</div>
                    <div className="metaValueNormal">
                      <select
                        className="select"
                        value={exp.status ?? '待开始'}
                        disabled={statusSaving}
                        onChange={(e) => void updateStatus(e.target.value)}
                      >
                        <option value="待开始">待开始</option>
                        <option value="进行中">进行中</option>
                        <option value="已结束">已结束</option>
                      </select>
                    </div>
                  </div>
                    <div className="metaItem">
                      <div className="metaLabel">工艺类型</div>
                      <div className="metaValueNormal">
                        {exp.process_type_id ? ptNameById.get(exp.process_type_id) ?? `#${exp.process_type_id}` : '未设置'}
                      </div>
                    </div>
                    <div className="metaItem">
                      <div className="metaLabel">开始时间</div>
                      <div className="metaValueNormal">{new Date(exp.start_at).toLocaleString()}</div>
                    </div>
                    <div className="metaItem">
                      <div className="metaLabel">结束时间</div>
                      <div className="metaValueNormal">{exp.end_at ? new Date(exp.end_at).toLocaleString() : '未结束'}</div>
                    </div>
                  </div>

                  <div className="metaBlock">
                    <div className="metaBlockTitle">调试目标</div>
                    <div className="metaBlockBody">{exp.debug_goal || '未填写'}</div>
                  </div>
                  {exp.note ? (
                    <div className="metaBlock">
                      <div className="metaBlockTitle">备注</div>
                      <div className="metaBlockBody">{exp.note}</div>
                    </div>
                  ) : null}
                </>
              ) : (
                <form id="experimentInlineForm" onSubmit={saveExperiment}>
                  <div className="fieldRow" style={{ marginTop: 8 }}>
                    <div className="field">
                      <div className="label">客户 *</div>
                      <input className="input" list="detailCustomerSuggestions" value={fCustomer} onChange={(e) => setFCustomer(e.target.value)} />
                      <datalist id="detailCustomerSuggestions">
                        {customerSuggestions.map((x) => (
                          <option key={x} value={x} />
                        ))}
                      </datalist>
                      {fCustomer.trim() !== '' && fCustomer.trim() !== '其它' && !knownCustomers.has(fCustomer.trim()) ? (
                        <div style={{ marginTop: 6, color: '#92400e', fontSize: 12 }}>提示：这是新的客户（将作为新项保存）</div>
                      ) : null}
                    </div>
                    <div className="field">
                      <div className="label">项目号 *</div>
                      <input className="input" value={fProjectNo} onChange={(e) => setFProjectNo(e.target.value)} />
                    </div>
                  </div>

                  <div className="fieldRow" style={{ marginTop: 12 }}>
                    <div className="field">
                      <div className="label">胶型号 *</div>
                      <input className="input" list="detailModelSuggestions" value={fModel} onChange={(e) => setFModel(e.target.value)} />
                      <datalist id="detailModelSuggestions">
                        {modelSuggestions.map((x) => (
                          <option key={x} value={x} />
                        ))}
                      </datalist>
                      {fModel.trim() !== '' && fModel.trim() !== '其它' && !knownModels.has(fModel.trim()) ? (
                        <div style={{ marginTop: 6, color: '#92400e', fontSize: 12 }}>提示：这是新的硅胶型号（将作为新项保存）</div>
                      ) : null}
                    </div>
                    <div className="field">
                      <div className="label">状态</div>
                      <select className="select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                        <option value="待开始">待开始</option>
                        <option value="进行中">进行中</option>
                        <option value="已结束">已结束</option>
                      </select>
                    </div>
                    <div className="field">
                      <div className="label">工艺类型 *</div>
                      <select className="select" value={fProcessTypeId} onChange={(e) => setFProcessTypeId(e.target.value)}>
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
                    <textarea className="textarea" rows={4} value={fGoal} onChange={(e) => setFGoal(e.target.value)} />
                  </div>

                  <div className="fieldRow" style={{ marginTop: 12 }}>
                    <div className="field">
                      <div className="label">开始时间（ISO） *</div>
                      <input className="input" value={fStartAt} onChange={(e) => setFStartAt(e.target.value)} />
                    </div>
                    <div className="field">
                      <div className="label">结束时间（可选，ISO）</div>
                      <input className="input" value={fEndAt} onChange={(e) => setFEndAt(e.target.value)} placeholder="留空则默认等于开始时间" />
                    </div>
                  </div>

                  <div className="field" style={{ marginTop: 12 }}>
                    <div className="label">备注（可选）</div>
                    <textarea className="textarea" rows={3} value={fNote} onChange={(e) => setFNote(e.target.value)} />
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="card">
            <div className="cardBody">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 650 }}>记录</div>
                  {effectiveFinalId ? (
                    <span className="pill" style={{ background: '#fb923c', color: '#fff' }}>
                      已选择最终：#{effectiveFinalId}
                    </span>
                  ) : (
                    <span className="pill">未选择最终</span>
                  )}
                  {draftFinalRecordId !== undefined ? <span className="pill">待提交</span> : null}
                  {Object.keys(draftEdits).length > 0 ? <span className="pill">已编辑 {Object.keys(draftEdits).length} 条</span> : null}
                  {Object.keys(draftDeletes).length > 0 ? <span className="pill">待删除 {Object.keys(draftDeletes).length} 条</span> : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ color: '#525252', fontSize: 13 }}>T10/T90 单位：秒</div>
                  {!recordEditMode ? (
                    <button className="btn" type="button" onClick={() => setRecordEditMode(true)}>
                      编辑记录
                    </button>
                  ) : (
                    <>
                      <button className="btn" type="button" onClick={discardRecordDrafts} disabled={recordApplying}>
                        取消
                      </button>
                      <button className="btn btnPrimary" type="button" onClick={applyRecordDrafts} disabled={recordApplying}>
                        {recordApplying ? '提交中…' : '完成'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>硫化剂A</th>
                    <th>A%</th>
                    <th>硫化剂B</th>
                    <th>B%</th>
                    <th>ML</th>
                    <th>MH</th>
                    <th>T10（秒）</th>
                    <th>T90（秒）</th>
                    <th>气泡</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {recordsSorted.map((r) => (
                    <tr
                      key={r.id}
                      style={(() => {
                        const isFinal = effectiveFinalId != null && r.id === effectiveFinalId
                        const isDeleted = !!draftDeletes[r.id]
                        if (isDeleted) return { opacity: 0.55, textDecoration: 'line-through' }
                        if (isFinal) return { background: '#fff7ed', outline: '1px solid #fed7aa' }
                        return undefined
                      })()}
                    >
                      <td>{caNameById.get(r.curing_agent_a_id) ?? `#${r.curing_agent_a_id}`}</td>
                      <td>{r.ratio_a_pct}</td>
                      <td>{caNameById.get(r.curing_agent_b_id) ?? `#${r.curing_agent_b_id}`}</td>
                      <td>{r.ratio_b_pct}</td>
                      <td>{r.ml}</td>
                      <td>{r.mh}</td>
                      <td>{r.t10_sec}</td>
                      <td>{r.t90_sec}</td>
                      <td>{r.bubble_grade}</td>
                      <td title={r.note ?? ''} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.note ?? ''}
                      </td>
                      <td>
                        {recordEditMode ? (
                          <>
                            {effectiveFinalId === r.id ? (
                              <button className="btn" type="button" onClick={clearFinalDraft}>
                                取消最终
                              </button>
                            ) : (
                              <button className="btn" type="button" onClick={() => setFinalDraft(r.id)}>
                                设为最终
                              </button>
                            )}
                            <button
                              className="btn"
                              style={{ marginLeft: 8 }}
                              onClick={() => {
                                const merged = draftEdits[r.id]
                                  ? ({ ...r, ...(draftEdits[r.id] as any) } as TrialRecord)
                                  : r
                                setEditing(merged)
                                setEditOpen(true)
                              }}
                            >
                              编辑
                            </button>
                            <button
                              className={draftDeletes[r.id] ? 'btn' : 'btn btnDanger'}
                              style={{ marginLeft: 8 }}
                              onClick={() => toggleDeleteDraft(r.id)}
                            >
                              {draftDeletes[r.id] ? '撤销删除' : '删除'}
                            </button>
                          </>
                        ) : (
                          <span style={{ color: '#525252', fontSize: 12 }}>点击上方“编辑记录”后可操作</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {exp.records.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ color: '#525252', padding: 14 }}>
                        暂无记录。点击右上角“新增记录”。
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <RecordModal
        open={recordOpen}
        experimentId={experimentId}
        onClose={() => setRecordOpen(false)}
        onSaved={async () => {
          setSuccess('记录已保存')
          setTimeout(() => setSuccess(null), 2000)
          await load()
        }}
      />

      <RecordModal
        open={editOpen}
        mode="draft"
        record={editing ?? undefined}
        experimentId={experimentId}
        onDraftSaved={applyDraftSaved}
        onClose={() => {
          setEditOpen(false)
          setEditing(null)
        }}
        onSaved={() => {}}
      />

      <ConfirmModal
        open={deleteConfirmOpen}
        title="确认删除实验？"
        confirmText="删除"
        cancelText="取消"
        confirmDanger
        disableConfirm={deleting}
        checkboxLabel="不再显示该确认框（以后将直接删除）"
        checkboxChecked={deleteConfirmDontAskAgain}
        onCheckboxChange={setDeleteConfirmDontAskAgain}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          setDeleteConfirmOpen(false)
          if (deleteConfirmDontAskAgain) {
            setSkipExperimentDeleteConfirm(true)
            setSkipDeleteConfirm(true)
          }
          void performDeleteExperiment()
        }}
      >
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {exp
            ? `确认删除实验 #${exp.id} 吗？\n将同时删除该实验下的 ${exp.records?.length ?? 0} 条记录（不可恢复）。`
            : '确认删除该实验吗？（不可恢复）'}
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={applyConfirmOpen}
        title="确认提交记录修改？"
        confirmText="提交"
        cancelText="取消"
        confirmDanger={false}
        disableConfirm={recordApplying}
        onCancel={() => setApplyConfirmOpen(false)}
        onConfirm={() => {
          setApplyConfirmOpen(false)
          void performApplyRecordDrafts()
        }}
      >
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{applyConfirmText}</div>
      </ConfirmModal>
    </div>
  )
}

