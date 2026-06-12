import { useEffect, useMemo, useState } from 'react'
import { ApiError, listAuditEvents } from '../lib/data'
import type { AuditEvent } from '../lib/types'

function humanizeApiError(e: unknown, action: string): string {
  if (!(e instanceof ApiError)) return `${action}失败：${String(e)}`
  const d = e.detail as unknown
  const rawDetail =
    typeof d === 'string'
      ? d
      : d && typeof d === 'object' && 'detail' in d
        ? (d as { detail?: unknown }).detail
        : d
  if (typeof rawDetail === 'string' && rawDetail) return `${action}失败：${rawDetail}`
  return `${action}失败：HTTP ${e.status}`
}

function fmtDt(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString()
}

function actionLabel(action: string) {
  const m: Record<string, string> = {
    'experiment.create': '新增实验',
    'experiment.update': '修改实验',
    'experiment.delete': '删除实验',
    'record.create': '新增记录',
    'record.update': '修改记录',
    'record.delete': '删除记录',
    'material.create': '新增原材料',
    'material.update': '修改原材料',
    'material.delete': '删除原材料',
    'curing_agent.create': '新增固化剂',
    'curing_agent.update': '修改固化剂',
    'curing_agent.delete': '删除固化剂',
  }
  return m[action] ?? `未知动作（${action}）`
}

function entityTypeLabel(entityType: string) {
  const m: Record<string, string> = {
    experiment: '实验',
    record: '记录',
    material: '原材料',
    curing_agent: '固化剂',
  }
  return m[entityType] ?? `对象（${entityType}）`
}

function fieldLabel(field: string) {
  const m: Record<string, string> = {
    // common
    name: '名称',
    note: '备注',
    status: '状态',
    start_at: '开始时间',
    end_at: '结束时间',
    process_type_id: '工艺类型',
    customer_name: '客户',
    project_no: '项目号',
    silicone_model: '胶型号',
    debug_goal: '调试目标',
    final_record_id: '最终记录',
    // record
    curing_agent_a_id: '硫化剂A',
    curing_agent_b_id: '硫化剂B',
    ratio_a_pct: 'A比例（%）',
    ratio_b_pct: 'B比例（%）',
    ml: 'ML',
    mh: 'MH',
    t10_sec: 'T10（秒）',
    t90_sec: 'T90（秒）',
    bubble_grade: '气泡等级',
    // materials
    category: '类别',
    hydrogen_content: '氢含量',
    vinyl_content: '乙烯基',
    volatile_min: '挥发份min',
    volatile_max: '挥发份max',
    avg_mw_wan: '分子量',
    pt_ppm: 'Pt(ppm)',
  }
  return m[field] ?? field
}

function fmtValue(v: unknown) {
  if (v == null) return '空'
  if (typeof v === 'string') {
    // best-effort ISO datetime
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return fmtDt(v)
    return v
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

type DiffItem = { from: unknown; to: unknown }

function toDiffList(diff: unknown): Array<{ field: string; from: unknown; to: unknown }> {
  if (!diff || typeof diff !== 'object') return []
  const out: Array<{ field: string; from: unknown; to: unknown }> = []
  for (const [k, v] of Object.entries(diff as Record<string, unknown>)) {
    if (v && typeof v === 'object' && 'from' in v && 'to' in v) {
      const d = v as DiffItem
      out.push({ field: k, from: d.from, to: d.to })
    }
  }
  return out
}

export function AuditEventsPage() {
  const [items, setItems] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [tsFrom, setTsFrom] = useState('')
  const [tsTo, setTsTo] = useState('')
  const [actorId, setActorId] = useState('')
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')

  const [selected, setSelected] = useState<AuditEvent | null>(null)

  const filters = useMemo(() => {
    return {
      limit: 50,
      offset: 0,
      ts_from: tsFrom.trim() ? new Date(tsFrom).toISOString() : null,
      ts_to: tsTo.trim() ? new Date(tsTo).toISOString() : null,
      actor_id: actorId.trim() || null,
      action: action.trim() || null,
      entity_type: entityType.trim() || null,
      entity_id: entityId.trim() || null,
    }
  }, [action, actorId, entityId, entityType, tsFrom, tsTo])

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const res = await listAuditEvents(filters)
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      setErr(humanizeApiError(e, '加载'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="pageHeader">
        <div className="pageTitle">审计日志</div>
        <div className="toolbar">
          <button className="btn" type="button" onClick={load} disabled={loading}>
            刷新
          </button>
        </div>
      </div>

      {err ? <div className="errorBar">{err}</div> : null}

      <div className="card">
        <div className="cardBody">
          <div style={{ fontWeight: 650, marginBottom: 10 }}>筛选</div>
          <div className="fieldRow">
            <div className="field">
              <div className="label">开始时间</div>
              <input className="input" type="datetime-local" value={tsFrom} onChange={(e) => setTsFrom(e.target.value)} />
            </div>
            <div className="field">
              <div className="label">结束时间</div>
              <input className="input" type="datetime-local" value={tsTo} onChange={(e) => setTsTo(e.target.value)} />
            </div>
            <div className="field">
              <div className="label">actor_id</div>
              <input className="input" value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder="例如：1001" />
            </div>
          </div>
          <div className="fieldRow" style={{ marginTop: 12 }}>
            <div className="field">
              <div className="label">动作（代码）</div>
              <input className="input" value={action} onChange={(e) => setAction(e.target.value)} placeholder="例如：experiment.delete（可选）" />
            </div>
            <div className="field">
              <div className="label">对象类型（代码）</div>
              <input className="input" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="例如：experiment（可选）" />
            </div>
            <div className="field">
              <div className="label">对象ID</div>
              <input className="input" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="例如：21（可选）" />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="btn btnPrimary" type="button" onClick={load} disabled={loading}>
              {loading ? '加载中…' : '应用筛选'}
            </button>
            <span style={{ marginLeft: 10, color: '#525252', fontSize: 13 }}>
              当前返回：<b>{items.length}</b> 条 / 总计 <b>{total}</b> 条
            </span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="cardBody">
          <div style={{ fontWeight: 650, marginBottom: 10 }}>列表</div>
          {loading ? (
            <div>加载中…</div>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>动作</th>
                    <th>对象</th>
                    <th>操作人</th>
                    <th>请求ID</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((x) => (
                    <tr key={x.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDt(x.ts)}</td>
                      <td>
                        <div style={{ fontWeight: 650 }}>{actionLabel(x.action)}</div>
                        <div style={{ marginTop: 3, color: '#525252', fontSize: 12 }}>
                          {entityTypeLabel(x.entity_type)} #{x.entity_id}
                        </div>
                      </td>
                      <td>
                        {entityTypeLabel(x.entity_type)} #{x.entity_id}
                      </td>
                      <td>{x.actor_name ?? x.actor_id ?? '-'}</td>
                      <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                        {x.request_id ?? '-'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="linkBtn" type="button" onClick={() => setSelected(x)}>
                          详情
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ color: '#525252', padding: 14 }}>
                        暂无审计日志。你可以先进行一次“新增/编辑/删除实验或记录、编辑主数据”等操作再回来查看。
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected ? (
        <div className="modalOverlay" onMouseDown={() => setSelected(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ width: 920, maxWidth: 'calc(100vw - 24px)' }}>
            <div className="modalHeader">
              <div className="modalTitle">审计详情</div>
              <button className="btn" type="button" onClick={() => setSelected(null)}>
                关闭
              </button>
            </div>
            <div className="modalBody">
              <div style={{ color: '#525252', fontSize: 13, marginBottom: 10 }}>
                {fmtDt(selected.ts)} · {actionLabel(selected.action)} · {entityTypeLabel(selected.entity_type)} #{selected.entity_id}
              </div>
              <div className="fieldRow">
                <div className="field">
                  <div className="label">操作人</div>
                  <div>{selected.actor_name ?? selected.actor_id ?? '-'}</div>
                </div>
                <div className="field">
                  <div className="label">请求ID</div>
                  <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                    {selected.request_id ?? '-'}
                  </div>
                </div>
                <div className="field">
                  <div className="label">IP</div>
                  <div>{selected.ip ?? '-'}</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="label">变更字段</div>
                <div style={{ border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
                  <table className="table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '34%' }}>字段</th>
                        <th style={{ width: '33%' }}>从</th>
                        <th style={{ width: '33%' }}>到</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toDiffList(selected.diff).map((d) => (
                        <tr key={d.field}>
                          <td style={{ fontWeight: 650 }}>{fieldLabel(d.field)}</td>
                          <td style={{ color: '#525252' }}>{fmtValue(d.from)}</td>
                          <td>{fmtValue(d.to)}</td>
                        </tr>
                      ))}
                      {toDiffList(selected.diff).length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ color: '#525252', padding: 14 }}>
                            {selected.action.endsWith('.create')
                              ? '新增操作：没有字段变更列表。'
                              : selected.action.endsWith('.delete')
                                ? '删除操作：没有字段变更列表。'
                                : '没有字段变更列表。'}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

