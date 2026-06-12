import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, getDashboardStats } from '../lib/data'
import { PieChart } from '../components/PieChart'
import type { DashboardStats } from '../lib/types'

function humanizeApiError(e: unknown): string {
  if (!(e instanceof ApiError)) return String(e)
  const d = e.detail as unknown
  if (typeof d === 'string') return d
  if (d && typeof d === 'object' && 'detail' in d) return String((d as { detail?: unknown }).detail)
  return `HTTP ${e.status}`
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [completedDays, setCompletedDays] = useState(7)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const s = await getDashboardStats(completedDays, 5)
      setStats(s)
    } catch (e) {
      setErr(humanizeApiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedDays])

  const pieA = useMemo(() => {
    if (!stats) return []
    const xs = stats.curing_agents_a_top.map((x) => ({ label: x.name || `#${x.curing_agent_id}`, value: x.count }))
    if (stats.curing_agents_a_other_count > 0) xs.push({ label: '其它', value: stats.curing_agents_a_other_count })
    return xs
  }, [stats])
  const pieB = useMemo(() => {
    if (!stats) return []
    const xs = stats.curing_agents_b_top.map((x) => ({ label: x.name || `#${x.curing_agent_id}`, value: x.count }))
    if (stats.curing_agents_b_other_count > 0) xs.push({ label: '其它', value: stats.curing_agents_b_other_count })
    return xs
  }, [stats])

  function goExperiments(q: Record<string, string>) {
    const params = new URLSearchParams(q)
    navigate(`/experiments?${params.toString()}`)
  }

  return (
    <div className="container">
      <div className="pageHeader">
        <div className="pageTitle">总览</div>
        <div className="toolbar">
          <button className="btn" type="button" onClick={load} disabled={loading}>
            刷新
          </button>
        </div>
      </div>

      {err ? <div className="errorBar">加载失败：{err}</div> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="cardBody">
          {loading && !stats ? (
            <div>加载中…</div>
          ) : stats ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <div className="card" style={{ boxShadow: 'none' }}>
                <div className="cardBody">
                  <div style={{ color: '#525252', fontSize: 12 }}>进行中实验</div>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{stats.ongoing_experiments_count}</div>
                  <button className="linkBtn" type="button" onClick={() => goExperiments({ status: '进行中' })} style={{ marginTop: 8 }}>
                    查看列表 →
                  </button>
                </div>
              </div>

              <div className="card" style={{ boxShadow: 'none' }}>
                <div className="cardBody">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ color: '#525252', fontSize: 12 }}>已完成实验</div>
                    <select className="select" value={String(completedDays)} onChange={(e) => setCompletedDays(Number(e.target.value))} style={{ width: 110 }}>
                      <option value="7">近 7 天</option>
                      <option value="30">近 30 天</option>
                      <option value="90">近 90 天</option>
                    </select>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{stats.completed_experiments_count}</div>
                  <button className="linkBtn" type="button" onClick={() => goExperiments({ status: '已结束' })} style={{ marginTop: 8 }}>
                    查看列表 →
                  </button>
                </div>
              </div>

              <div className="card" style={{ boxShadow: 'none' }}>
                <div className="cardBody">
                  <div style={{ color: '#525252', fontSize: 12 }}>本周新增实验</div>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{stats.new_experiments_this_week_count}</div>
                  <button className="linkBtn" type="button" onClick={() => goExperiments({})} style={{ marginTop: 8 }}>
                    查看列表 →
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#525252' }}>暂无数据</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <div className="card">
          <div className="cardBody">
            <div style={{ fontWeight: 650, marginBottom: 10 }}>A 位最常用的硫化剂（前 5 名）</div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <PieChart data={pieA} />
              <div style={{ minWidth: 220, flex: 1 }}>
                {pieA.map((x) => (
                  <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.label}</div>
                    <div style={{ color: '#525252' }}>{x.value}</div>
                  </div>
                ))}
                {pieA.length === 0 ? <div style={{ color: '#525252' }}>暂无数据</div> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="cardBody">
            <div style={{ fontWeight: 650, marginBottom: 10 }}>B 位最常用的硫化剂（前 5 名）</div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <PieChart data={pieB} />
              <div style={{ minWidth: 220, flex: 1 }}>
                {pieB.map((x) => (
                  <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.label}</div>
                    <div style={{ color: '#525252' }}>{x.value}</div>
                  </div>
                ))}
                {pieB.length === 0 ? <div style={{ color: '#525252' }}>暂无数据</div> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

