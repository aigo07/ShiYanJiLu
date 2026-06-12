import type { AuthError, PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type {
  AuditEvent,
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

type SupabaseErrorLike = PostgrestError | AuthError | Error | null
type ErrorMeta = {
  status?: number
  code?: string
  message?: string
  details?: unknown
  hint?: unknown
}

function errorMeta(error: SupabaseErrorLike): ErrorMeta {
  if (error && typeof error === 'object') return error as ErrorMeta
  return {}
}

function statusFromError(error: SupabaseErrorLike): number {
  const e = errorMeta(error)
  if (!e) return 500
  if (typeof e.status === 'number') return e.status
  if (e.code === 'PGRST116' || e.code === 'P0002') return 404
  if (e.code === '23505') return 409
  if (e.code === '23503') return 409
  if (e.code === '23514') return 400
  if (e.code === '42501') return 403
  return 400
}

export function toApiError(error: SupabaseErrorLike, fallback = 'Request failed'): ApiError {
  if (error instanceof ApiError) return error
  const e = errorMeta(error)
  return new ApiError(e?.message || fallback, statusFromError(error), {
    detail: e?.message || fallback,
    code: e?.code,
    details: e?.details,
    hint: e?.hint,
  })
}

function throwIf(error: SupabaseErrorLike, fallback?: string): void {
  if (error) throw toApiError(error, fallback)
}

function one<T>(data: T | null, error: SupabaseErrorLike, fallback?: string): T {
  throwIf(error, fallback)
  if (data == null) throw new ApiError(fallback ?? 'Not found', 404, { detail: fallback ?? 'Not found' })
  return data
}

function many<T>(data: T[] | null, error: SupabaseErrorLike, fallback?: string): T[] {
  throwIf(error, fallback)
  return data ?? []
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

export async function listProcessTypes(): Promise<ProcessType[]> {
  const { data, error } = await supabase.from('process_types').select('*').order('name', { ascending: true })
  return many<ProcessType>(data, error, '加载工艺类型失败')
}

export async function listMaterials(limit = 200, offset = 0): Promise<Material[]> {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)
  return many<Material>(data, error, '加载原材料失败')
}

export async function createMaterial(payload: Record<string, unknown>): Promise<Material> {
  const { data, error } = await supabase.from('materials').insert(cleanPayload(payload)).select('*').single()
  return one<Material>(data, error, '保存原材料失败')
}

export async function updateMaterial(id: number, payload: Record<string, unknown>): Promise<Material> {
  const { data, error } = await supabase.from('materials').update(cleanPayload(payload)).eq('id', id).select('*').single()
  return one<Material>(data, error, '更新原材料失败')
}

export async function deleteMaterial(id: number): Promise<void> {
  const { error } = await supabase.from('materials').delete().eq('id', id)
  throwIf(error, '删除原材料失败')
}

export async function listCuringAgents(limit = 200, offset = 0): Promise<CuringAgent[]> {
  const { data, error } = await supabase.rpc('curing_agents_with_usage', {
    p_limit: limit,
    p_offset: offset,
  })
  return many<CuringAgent>(data, error, '加载固化剂失败')
}

export async function createCuringAgent(payload: Record<string, unknown>): Promise<CuringAgent> {
  const { data, error } = await supabase.from('curing_agents').insert(cleanPayload(payload)).select('*').single()
  if (error) throw toApiError(error, '保存固化剂失败')
  const usedRecordCount = { ...(data as CuringAgent), used_record_count: 0 }
  return usedRecordCount
}

export async function updateCuringAgent(id: number, payload: Record<string, unknown>): Promise<CuringAgent> {
  const { data, error } = await supabase.from('curing_agents').update(cleanPayload(payload)).eq('id', id).select('*').single()
  if (error) throw toApiError(error, '更新固化剂失败')
  const { data: usageData, error: usageError } = await supabase.rpc('curing_agents_with_usage', { p_limit: 200, p_offset: 0 })
  throwIf(usageError, '刷新固化剂失败')
  return (usageData as CuringAgent[] | null)?.find((x) => x.id === id) ?? ({ ...(data as CuringAgent), used_record_count: 0 })
}

export async function deleteCuringAgent(id: number): Promise<void> {
  const { error } = await supabase.from('curing_agents').delete().eq('id', id)
  throwIf(error, '删除固化剂失败')
}

export type ListExperimentsParams = {
  process_type_id?: number | null
  status?: string | null
  curing_agent_id?: number | null
  q?: string | null
  limit?: number
  offset?: number
}

export async function listExperiments(params: ListExperimentsParams = {}): Promise<Experiment[]> {
  const { data, error } = await supabase.rpc('list_experiments', {
    p_process_type_id: params.process_type_id ?? null,
    p_status: params.status || null,
    p_curing_agent_id: params.curing_agent_id ?? null,
    p_q: params.q || null,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
  })
  return many<Experiment>(data, error, '加载实验失败')
}

export async function getExperiment(id: number): Promise<Experiment> {
  const { data, error } = await supabase.from('experiments').select('*').eq('id', id).single()
  return one<Experiment>(data, error, 'Experiment not found')
}

export async function getExperimentWithRecords(id: number): Promise<Experiment & { records: TrialRecord[] }> {
  const [experiment, records] = await Promise.all([
    getExperiment(id),
    listRecords({ experiment_id: id, limit: 200, offset: 0 }),
  ])
  return { ...experiment, records }
}

export async function createExperiment(payload: Record<string, unknown>): Promise<Experiment> {
  const { data, error } = await supabase.from('experiments').insert(cleanPayload(payload)).select('*').single()
  return one<Experiment>(data, error, '保存实验失败')
}

export async function updateExperiment(id: number, payload: Record<string, unknown>): Promise<Experiment> {
  const { data, error } = await supabase.from('experiments').update(cleanPayload(payload)).eq('id', id).select('*').single()
  return one<Experiment>(data, error, '更新实验失败')
}

export async function deleteExperiment(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_experiment', { p_experiment_id: id })
  throwIf(error, '删除实验失败')
}

export type ListRecordsParams = {
  experiment_id?: number | null
  process_type_id?: number | null
  limit?: number
  offset?: number
}

export async function listRecords(params: ListRecordsParams = {}): Promise<TrialRecord[]> {
  const { data, error } = await supabase.rpc('list_records', {
    p_experiment_id: params.experiment_id ?? null,
    p_process_type_id: params.process_type_id ?? null,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
  })
  return many<TrialRecord>(data, error, '加载记录失败')
}

export async function createRecord(payload: Record<string, unknown>): Promise<TrialRecord> {
  const { data, error } = await supabase.from('records').insert(cleanPayload(payload)).select('*').single()
  return one<TrialRecord>(data, error, '保存记录失败')
}

export async function updateRecord(id: number, payload: Record<string, unknown>): Promise<TrialRecord> {
  const { data, error } = await supabase.from('records').update(cleanPayload(payload)).eq('id', id).select('*').single()
  return one<TrialRecord>(data, error, '更新记录失败')
}

export async function deleteRecord(id: number): Promise<void> {
  const { error } = await supabase.from('records').delete().eq('id', id)
  throwIf(error, '删除记录失败')
}

export async function getExperimentSuggestions(limit = 200): Promise<ExperimentSuggestions> {
  const { data, error } = await supabase.rpc('experiment_suggestions', { p_limit: limit })
  return one<ExperimentSuggestions>(data as ExperimentSuggestions | null, error, '加载实验建议失败')
}

export async function getDashboardStats(completedDays = 7, topN = 5): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('dashboard_stats', {
    p_completed_days: completedDays,
    p_top_n: topN,
  })
  return one<DashboardStats>(data as DashboardStats | null, error, '加载仪表盘失败')
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

export async function listAuditEvents(filters: AuditEventFilters = {}): Promise<AuditEventList> {
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  let query = supabase
    .from('audit_events')
    .select('*', { count: 'exact' })
    .order('ts', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filters.ts_from) query = query.gte('ts', filters.ts_from)
  if (filters.ts_to) query = query.lte('ts', filters.ts_to)
  if (filters.actor_id) query = query.eq('actor_id', filters.actor_id)
  if (filters.entity_type) query = query.eq('entity_type', filters.entity_type)
  if (filters.entity_id) query = query.eq('entity_id', filters.entity_id)
  if (filters.action) query = query.eq('action', filters.action)

  const { data, error, count } = await query
  return {
    items: many<AuditEvent>(data, error, '加载审计日志失败'),
    total: count ?? 0,
  }
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

export async function getExportRecordsRows(filters: ExportFilters = {}): Promise<ExportRecordRow[]> {
  const { data, error } = await supabase.rpc('export_records_rows', {
    p_experiment_id: filters.experiment_id ?? null,
    p_process_type_id: filters.process_type_id ?? null,
    p_status: filters.status || null,
    p_curing_agent_id: filters.curing_agent_id ?? null,
    p_customer_q: filters.customer_q || null,
    p_silicone_model_q: filters.silicone_model_q || null,
    p_project_no_q: filters.project_no_q || null,
    p_start_from: filters.start_from || null,
    p_start_to: filters.start_to || null,
    p_only_final: filters.only_final ?? false,
    p_limit: filters.limit ?? 20000,
  })
  return many<ExportRecordRow>(data, error, '导出记录失败')
}

export async function getExportExperimentsRows(filters: ExportFilters = {}): Promise<ExportExperimentRow[]> {
  const { data, error } = await supabase.rpc('export_experiments_rows', {
    p_process_type_id: filters.process_type_id ?? null,
    p_status: filters.status || null,
    p_curing_agent_id: filters.curing_agent_id ?? null,
    p_customer_q: filters.customer_q || null,
    p_silicone_model_q: filters.silicone_model_q || null,
    p_project_no_q: filters.project_no_q || null,
    p_start_from: filters.start_from || null,
    p_start_to: filters.start_to || null,
  })
  return many<ExportExperimentRow>(data, error, '导出实验失败')
}
