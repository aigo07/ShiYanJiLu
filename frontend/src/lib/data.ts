import { apiRequest, queryString, type ApiErrorDetail } from './api'
import type {
  AuditEventList,
  CuringAgent,
  DashboardStats,
  Experiment,
  ExperimentSuggestions,
  ExportExperimentRow,
  ExportRecordRow,
  Material,
  ProcessType,
  Record as TrialRecord,
} from './types'

export class ApiError extends Error {
  status: number
  detail?: unknown

  constructor(message: string, status: number, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export function toApiError(error: unknown, fallback = 'Request failed'): ApiError {
  if (error instanceof ApiError) return error
  const e = error as { message?: string; status?: unknown; detail?: ApiErrorDetail } | null
  const status = typeof e?.status === 'number' ? e.status : 500
  return new ApiError(e?.message || fallback, status, e?.detail ?? { detail: e?.message || fallback })
}

function wrap<T>(promise: Promise<T>, fallback: string): Promise<T> {
  return promise.catch((error) => {
    throw toApiError(error, fallback)
  })
}

function cleanPayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T
}

export function humanizeApiError(e: unknown, action?: string): string {
  const prefix = action ? `${action}失败：` : ''
  if (!(e instanceof ApiError)) return `${prefix}${String(e)}`
  const d = e.detail as unknown
  const rawDetail =
    typeof d === 'string'
      ? d
      : d && typeof d === 'object' && 'detail' in d
        ? (d as { detail?: unknown }).detail
        : d
  if (Array.isArray(rawDetail)) return `${prefix}输入有误，请检查填写。`
  if (typeof rawDetail === 'string' && rawDetail) return `${prefix}${rawDetail}`
  return `${prefix}HTTP ${e.status}`
}

export function listProcessTypes(): Promise<ProcessType[]> {
  return wrap(apiRequest<ProcessType[]>('/process-types'), '加载工艺类型失败')
}

export function listMaterials(limit = 200, offset = 0): Promise<Material[]> {
  return wrap(apiRequest<Material[]>(`/materials${queryString({ limit, offset })}`), '加载原材料失败')
}

export function createMaterial(payload: Record<string, unknown>): Promise<Material> {
  return wrap(apiRequest<Material>('/materials', { method: 'POST', body: JSON.stringify(cleanPayload(payload)) }), '保存原材料失败')
}

export function updateMaterial(id: number, payload: Record<string, unknown>): Promise<Material> {
  return wrap(
    apiRequest<Material>(`/materials/${id}`, { method: 'PATCH', body: JSON.stringify(cleanPayload(payload)) }),
    '更新原材料失败',
  )
}

export function deleteMaterial(id: number): Promise<void> {
  return wrap(apiRequest<void>(`/materials/${id}`, { method: 'DELETE' }), '删除原材料失败')
}

export function listCuringAgents(limit = 200, offset = 0): Promise<CuringAgent[]> {
  return wrap(apiRequest<CuringAgent[]>(`/curing-agents${queryString({ limit, offset })}`), '加载固化剂失败')
}

export function createCuringAgent(payload: Record<string, unknown>): Promise<CuringAgent> {
  return wrap(
    apiRequest<CuringAgent>('/curing-agents', { method: 'POST', body: JSON.stringify(cleanPayload(payload)) }),
    '保存固化剂失败',
  )
}

export function updateCuringAgent(id: number, payload: Record<string, unknown>): Promise<CuringAgent> {
  return wrap(
    apiRequest<CuringAgent>(`/curing-agents/${id}`, { method: 'PATCH', body: JSON.stringify(cleanPayload(payload)) }),
    '更新固化剂失败',
  )
}

export function deleteCuringAgent(id: number): Promise<void> {
  return wrap(apiRequest<void>(`/curing-agents/${id}`, { method: 'DELETE' }), '删除固化剂失败')
}

export type ListExperimentsParams = {
  process_type_id?: number | null
  status?: string | null
  curing_agent_id?: number | null
  q?: string | null
  limit?: number
  offset?: number
}

export function listExperiments(params: ListExperimentsParams = {}): Promise<Experiment[]> {
  return wrap(apiRequest<Experiment[]>(`/experiments${queryString(params)}`), '加载实验失败')
}

export function getExperiment(id: number): Promise<Experiment> {
  return wrap(apiRequest<Experiment>(`/experiments/${id}`), 'Experiment not found')
}

export async function getExperimentWithRecords(id: number): Promise<Experiment & { records: TrialRecord[] }> {
  const [experiment, records] = await Promise.all([
    getExperiment(id),
    listRecords({ experiment_id: id, limit: 200, offset: 0 }),
  ])
  return { ...experiment, records }
}

export function createExperiment(payload: Record<string, unknown>): Promise<Experiment> {
  return wrap(
    apiRequest<Experiment>('/experiments', { method: 'POST', body: JSON.stringify(cleanPayload(payload)) }),
    '保存实验失败',
  )
}

export function updateExperiment(id: number, payload: Record<string, unknown>): Promise<Experiment> {
  return wrap(
    apiRequest<Experiment>(`/experiments/${id}`, { method: 'PATCH', body: JSON.stringify(cleanPayload(payload)) }),
    '更新实验失败',
  )
}

export function deleteExperiment(id: number): Promise<void> {
  return wrap(apiRequest<void>(`/experiments/${id}`, { method: 'DELETE' }), '删除实验失败')
}

export type ListRecordsParams = {
  experiment_id?: number | null
  process_type_id?: number | null
  limit?: number
  offset?: number
}

export function listRecords(params: ListRecordsParams = {}): Promise<TrialRecord[]> {
  return wrap(apiRequest<TrialRecord[]>(`/records${queryString(params)}`), '加载记录失败')
}

export function createRecord(payload: Record<string, unknown>): Promise<TrialRecord> {
  return wrap(apiRequest<TrialRecord>('/records', { method: 'POST', body: JSON.stringify(cleanPayload(payload)) }), '保存记录失败')
}

export function updateRecord(id: number, payload: Record<string, unknown>): Promise<TrialRecord> {
  return wrap(apiRequest<TrialRecord>(`/records/${id}`, { method: 'PATCH', body: JSON.stringify(cleanPayload(payload)) }), '更新记录失败')
}

export function deleteRecord(id: number): Promise<void> {
  return wrap(apiRequest<void>(`/records/${id}`, { method: 'DELETE' }), '删除记录失败')
}

export function getExperimentSuggestions(limit = 200): Promise<ExperimentSuggestions> {
  return wrap(apiRequest<ExperimentSuggestions>(`/experiment-suggestions${queryString({ limit })}`), '加载实验建议失败')
}

export function getDashboardStats(completedDays = 7, topN = 5): Promise<DashboardStats> {
  return wrap(
    apiRequest<DashboardStats>(`/dashboard-stats${queryString({ completed_days: completedDays, top_n: topN })}`),
    '加载仪表盘失败',
  )
}

export type AuditEventFilters = {
  ts_from?: string | null
  ts_to?: string | null
  actor_id?: string | null
  entity_type?: string | null
  entity_id?: string | null
  action?: string | null
  limit?: number
  offset?: number
}

export function listAuditEvents(filters: AuditEventFilters = {}): Promise<AuditEventList> {
  return wrap(apiRequest<AuditEventList>(`/audit-events${queryString(filters)}`), '加载审计日志失败')
}

export type ExportFilters = {
  experiment_id?: number | null
  process_type_id?: number | null
  status?: string | null
  curing_agent_id?: number | null
  customer_q?: string | null
  silicone_model_q?: string | null
  project_no_q?: string | null
  start_from?: string | null
  start_to?: string | null
  only_final?: boolean
  limit?: number
}

export function getExportRecordsRows(filters: ExportFilters = {}): Promise<ExportRecordRow[]> {
  return wrap(apiRequest<ExportRecordRow[]>(`/exports/records${queryString(filters)}`), '导出记录失败')
}

export function getExportExperimentsRows(filters: ExportFilters = {}): Promise<ExportExperimentRow[]> {
  return wrap(apiRequest<ExportExperimentRow[]>(`/exports/experiments${queryString(filters)}`), '导出实验失败')
}
