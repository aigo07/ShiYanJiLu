import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError, listCuringAgents, listExperiments, listProcessTypes } from '../lib/data'
import { downloadExperimentsRecordsZip, downloadRecordsCsv } from '../lib/exportFiles'
import { getTableDensity, setTableDensity, type TableDensity } from '../lib/prefs'
import type { CuringAgent, Experiment, ProcessType } from '../lib/types'
import { RecordModal } from '../components/RecordModal'

function formatDate(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString()
}

export function ExperimentsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([])
  const [processTypeId, setProcessTypeId] = useState<string>('') // '' = all
  const [status, setStatus] = useState<string>('') // '' = all
  const [curingAgents, setCuringAgents] = useState<CuringAgent[]>([])
  const [curingAgentId, setCuringAgentId] = useState<string>('') // '' = all
  const [q, setQ] = useState<string>('') // '' = all
  const [items, setItems] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportingZip, setExportingZip] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)
  const [tableDensity, setTableDensityState] = useState<TableDensity>(() => getTableDensity())

  const suppressUrlSyncRef = useRef(false)
  const pageSize = 50

  const processTypeNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of processTypes) m.set(p.id, p.name)
    return m
  }, [processTypes])

  function setQueryParam(key: string, value: string) {
    const params = new URLSearchParams(location.search)
    const next = value.trim()
    if (next) params.set(key, next)
    else params.delete(key)
    suppressUrlSyncRef.current = true
    navigate(`/experiments?${params.toString()}`, { replace: true })
  }

  useEffect(() => {
    suppressUrlSyncRef.current = false
    const params = new URLSearchParams(location.search)
    setProcessTypeId(params.get('process_type_id') ?? '')
    setStatus(params.get('status') ?? '')
    setCuringAgentId(params.get('curing_agent_id') ?? '')
    setQ(params.get('q') ?? '')
  }, [location.search])

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const [pts, cas] = await Promise.all([
        listProcessTypes(),
        listCuringAgents(200, 0),
      ])
      setProcessTypes(pts)
      setCuringAgents(cas)
      const exps = await listExperiments({
        limit: pageSize,
        offset: 0,
        process_type_id: processTypeId ? Number(processTypeId) : null,
        status: status || null,
        curing_agent_id: curingAgentId ? Number(curingAgentId) : null,
        q: q.trim() || null,
      })
      setItems(exps)
      setHasMore(exps.length === pageSize)
    } catch (e) {
      if (e instanceof ApiError) setErr(JSON.stringify(e.detail ?? e.message))
      else setErr(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    setErr(null)
    try {
      const offset = items.length
      const exps = await listExperiments({
        limit: pageSize,
        offset,
        process_type_id: processTypeId ? Number(processTypeId) : null,
        status: status || null,
        curing_agent_id: curingAgentId ? Number(curingAgentId) : null,
        q: q.trim() || null,
      })
      setItems((prev) => [...prev, ...exps])
      setHasMore(exps.length === pageSize)
    } catch (e) {
      if (e instanceof ApiError) setErr(JSON.stringify(e.detail ?? e.message))
      else setErr(String(e))
    } finally {
      setLoadingMore(false)
    }
  }

  async function exportRecordsCsv() {
    setErr(null)
    setSuccess(null)
    setExporting(true)
    try {
      await downloadRecordsCsv({
        limit: 20000,
        process_type_id: processTypeId ? Number(processTypeId) : null,
        status: status || null,
        curing_agent_id: curingAgentId ? Number(curingAgentId) : null,
      })
      setSuccess('CSV 已下载')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
    }
  }

  async function exportExperimentsAndRecordsZip() {
    setErr(null)
    setSuccess(null)
    setExportingZip(true)
    try {
      await downloadExperimentsRecordsZip({
        limit: 20000,
        process_type_id: processTypeId ? Number(processTypeId) : null,
        status: status || null,
        curing_agent_id: curingAgentId ? Number(curingAgentId) : null,
      })
      setSuccess('ZIP 已下载')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setExportingZip(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processTypeId, status, curingAgentId, q])

  const activeFilterPills = useMemo(() => {
    const pills: { key: string; label: string }[] = []
    if (status) pills.push({ key: 'status', label: `状态：${status}` })
    if (processTypeId) pills.push({ key: 'process_type_id', label: `工艺类型：${processTypeNameById.get(Number(processTypeId)) ?? `#${processTypeId}`}` })
    if (curingAgentId) pills.push({ key: 'curing_agent_id', label: `固化剂：${curingAgents.find((c) => String(c.id) === curingAgentId)?.name ?? `#${curingAgentId}`}` })
    if (q.trim()) pills.push({ key: 'q', label: `搜索：${q.trim()}` })
    return pills
  }, [status, processTypeId, curingAgentId, q, processTypeNameById, curingAgents])

  useEffect(() => {
    function onDocClick() {
      setExportMenuOpen(false)
      setCreateMenuOpen(false)
    }
    if (!exportMenuOpen && !createMenuOpen) return
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [exportMenuOpen, createMenuOpen])

  return (
    <div>
      <div className="pageHeader">
        <div className="pageTitle">实验</div>
        <div className="toolbar">
          <input
            className="input"
            value={q}
            onChange={(e) => {
              const next = e.target.value
              setQ(next)
              if (!suppressUrlSyncRef.current) setQueryParam('q', next)
            }}
            placeholder="搜索：客户/项目号/胶型号"
            style={{ width: 260 }}
          />
          <select className="select" value={processTypeId} onChange={(e) => setProcessTypeId(e.target.value)}>
            <option value="">工艺类型：全部</option>
            {processTypes.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">状态：全部</option>
            <option value="待开始">待开始</option>
            <option value="进行中">进行中</option>
            <option value="已结束">已结束</option>
          </select>
          <select className="select" value={curingAgentId} onChange={(e) => setCuringAgentId(e.target.value)}>
            <option value="">固化剂：全部</option>
            {curingAgents.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button className="btn btnPrimary" type="button" onClick={() => setCreateMenuOpen((x) => !x)}>
              新建 ▾
            </button>
            {createMenuOpen ? (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  minWidth: 180,
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: 12,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.10)',
                  overflow: 'hidden',
                  zIndex: 50,
                }}
              >
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setCreateMenuOpen(false)
                    navigate('/experiments/new')
                  }}
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 0 }}
                >
                  新建实验
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setCreateMenuOpen(false)
                    setRecordOpen(true)
                  }}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    border: 'none',
                    borderRadius: 0,
                    borderTop: '1px solid #f0f0f0',
                  }}
                >
                  新建记录
                </button>
              </div>
            ) : null}
          </div>
          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button
              className="btn"
              type="button"
              disabled={exporting || exportingZip}
              onClick={() => setExportMenuOpen((x) => !x)}
            >
              {exporting || exportingZip ? '导出中…' : '导出 ▾'}
            </button>
            {exportMenuOpen ? (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  minWidth: 200,
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: 12,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.10)',
                  overflow: 'hidden',
                  zIndex: 50,
                }}
              >
                <button
                  className="btn"
                  type="button"
                  disabled={exporting || exportingZip}
                  onClick={async () => {
                    setExportMenuOpen(false)
                    await exportExperimentsAndRecordsZip()
                  }}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    border: 'none',
                    borderRadius: 0,
                  }}
                >
                  导出实验+记录 ZIP
                </button>
                <button
                  className="btn"
                  type="button"
                  disabled={exporting || exportingZip}
                  onClick={async () => {
                    setExportMenuOpen(false)
                    await exportRecordsCsv()
                  }}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    border: 'none',
                    borderRadius: 0,
                    borderTop: '1px solid #f0f0f0',
                  }}
                >
                  导出记录 CSV
                </button>
              </div>
            ) : null}
          </div>
          <button
            className="btn"
            type="button"
            onClick={() => {
              const next: TableDensity = tableDensity === 'compact' ? 'comfortable' : 'compact'
              setTableDensityState(next)
              setTableDensity(next)
            }}
            title="切换表格密度（紧凑/舒适）"
          >
            密度：{tableDensity === 'compact' ? '紧凑' : '舒适'}
          </button>
        </div>
      </div>

      {err ? <div className="errorBar">请求失败：{err}</div> : null}
      {success ? <div className="successBar">{success}</div> : null}

      <div className="card">
        <div className="cardBody">
          {activeFilterPills.length ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {activeFilterPills.map((p) => (
                  <span key={p.key} className="pill">
                    {p.label}
                  </span>
                ))}
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setProcessTypeId('')
                  setStatus('')
                  setCuringAgentId('')
                  navigate('/experiments', { replace: true })
                }}
              >
                清空筛选
              </button>
            </div>
          ) : null}
          {loading ? (
            <div>加载中…</div>
          ) : (
            <div className="tableWrap">
              <table className={tableDensity === 'compact' ? 'table tableCompact' : 'table'}>
                <thead>
                  <tr>
                    <th>客户</th>
                    <th>项目号</th>
                    <th>胶型号</th>
                    <th>状态</th>
                    <th>工艺类型</th>
                    <th>开始</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((x) => (
                    <tr key={x.id} className="rowLink" onClick={() => navigate(`/experiments/${x.id}`)}>
                      <td>{x.customer_name}</td>
                      <td>{x.project_no}</td>
                      <td>{x.silicone_model}</td>
                      <td>
                        <span className="pill">{x.status || '待开始'}</span>
                      </td>
                      <td>
                        {x.process_type_id ? (
                          <span className="pill">{processTypeNameById.get(x.process_type_id) ?? `#${x.process_type_id}`}</span>
                        ) : (
                          <span className="pill">未设置</span>
                        )}
                      </td>
                      <td>{formatDate(x.start_at)}</td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ color: '#525252', padding: 14 }}>
                        暂无实验。点击右上角“新建实验”开始录入。
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}

          {!loading && items.length > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              {hasMore ? (
                <button className="btn" type="button" disabled={loadingMore} onClick={() => void loadMore()}>
                  {loadingMore ? '加载中…' : '加载更多'}
                </button>
              ) : (
                <div style={{ color: '#525252', fontSize: 13 }}>已加载全部</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <RecordModal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        onSaved={({ experimentId }) => {
          navigate(`/experiments/${experimentId}`)
        }}
      />
    </div>
  )
}

