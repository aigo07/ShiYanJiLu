import cloudbase from '@cloudbase/node-sdk'

type Role = 'admin' | 'auditor' | 'editor' | 'viewer'

type Profile = {
  id: string
  email: string | null
  display_name: string
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
}

type ProcessType = {
  id: number
  name: string
  created_at: string
  updated_at: string
}

type Material = {
  id: number
  category: string
  name: string
  hydrogen_content: number | null
  vinyl_content: number | null
  volatile_min: number | null
  volatile_max: number | null
  avg_mw_wan: number | null
  pt_ppm: number | null
  created_at: string
  updated_at: string
}

type CuringAgent = {
  id: number
  name: string
  default_ratio: number | null
  status: string | null
  note: string | null
  composition: Array<{ material_id: number; mass_pct: number }> | null
  created_at: string
  updated_at: string
  used_record_count?: number
}

type Experiment = {
  id: number
  customer_name: string
  project_no: string
  status: string
  debug_goal: string | null
  silicone_model: string
  process_type_id: number
  final_record_id: number | null
  start_at: string
  end_at: string | null
  cure_temp_c: number | null
  cure_time_min: number | null
  bake_temp_c: number | null
  bake_time_min: number | null
  sheet_thickness_mm: number | null
  note: string | null
  created_at: string
  updated_at: string
}

type TrialRecord = {
  id: number
  experiment_id: number
  process_type_id: number | null
  curing_agent_a_id: number
  curing_agent_b_id: number
  ratio_a_pct: number
  ratio_b_pct: number
  ml: number
  mh: number
  t10_sec: number
  t90_sec: number
  bubble_grade: number
  note: string | null
  cure_temp_c: number | null
  cure_time_min: number | null
  bake_temp_c: number | null
  bake_time_min: number | null
  sheet_thickness_mm: number | null
  created_at: string
  updated_at: string
}

type AuditEvent = {
  id: number
  ts: string
  actor_type: string
  actor_id: string | null
  actor_name: string | null
  action: string
  entity_type: string
  entity_id: string
  request_id: string | null
  ip: string | null
  user_agent: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  diff: Record<string, { from: unknown; to: unknown }> | null
  reason: string | null
}

type Doc<T> = T & { _id: string }
type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'OPTIONS'
type CloudbaseContext = Record<string, unknown>
type UserContext = {
  profile: Profile
  request_id: string | null
  ip: string | null
  user_agent: string | null
}

class HttpError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

const envId = process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV || process.env.SCF_NAMESPACE || ''
const app: any = cloudbase.init({ env: envId })
const db: any = app.database()
const _: any = db.command

const COLLECTIONS = [
  'profiles',
  'process_types',
  'materials',
  'curing_agents',
  'experiments',
  'records',
  'audit_events',
] as const

function nowIso() {
  return new Date().toISOString()
}

function nextId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000)
}

function stripDoc<T>(doc: Doc<T> | T): T {
  const { _id: _discarded, ...rest } = doc as Doc<T>
  return rest as T
}

function cleanPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}

function nullableString(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s ? s : null
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) throw new HttpError(400, '数值字段格式错误', 'BAD_NUMBER')
  return n
}

function requiredString(value: unknown, label: string): string {
  const s = nullableString(value)
  if (!s) throw new HttpError(400, `${label}不能为空`, 'REQUIRED')
  return s
}

function requiredNumber(value: unknown, label: string): number {
  const n = nullableNumber(value)
  if (n == null) throw new HttpError(400, `${label}不能为空`, 'REQUIRED')
  return n
}

async function getAll<T>(collectionName: string, max = 5000): Promise<Array<Doc<T>>> {
  const out: Array<Doc<T>> = []
  for (let offset = 0; offset < max; offset += 100) {
    const res = await db.collection(collectionName).where({}).skip(offset).limit(100).get()
    const data = (res.data ?? []) as Array<Doc<T>>
    out.push(...data)
    if (data.length < 100) break
  }
  return out
}

async function findById<T>(collectionName: string, id: number | string): Promise<Doc<T> | null> {
  const res = await db.collection(collectionName).where({ id }).limit(1).get()
  return ((res.data ?? [])[0] as Doc<T> | undefined) ?? null
}

async function updateByDocId(collectionName: string, docId: string, data: Record<string, unknown>) {
  await db.collection(collectionName).doc(docId).update(cleanPayload(data))
}

async function removeByDocId(collectionName: string, docId: string) {
  await db.collection(collectionName).doc(docId).remove()
}

async function addDoc<T extends Record<string, unknown>>(collectionName: string, data: T): Promise<Doc<T>> {
  const res = await db.collection(collectionName).add(data)
  return { ...data, _id: res.id } as Doc<T>
}

function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of keys) {
    if (key === '_id') continue
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { from: before[key], to: after[key] }
    }
  }
  return changes
}

async function audit(ctx: UserContext, action: string, entityType: string, entityId: string | number, beforeRow: unknown, afterRow: unknown) {
  const event: AuditEvent = {
    id: nextId(),
    ts: nowIso(),
    actor_type: 'user',
    actor_id: ctx.profile.id,
    actor_name: ctx.profile.display_name,
    action,
    entity_type: entityType,
    entity_id: String(entityId),
    request_id: ctx.request_id,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    before: beforeRow ? (stripDoc(beforeRow as Doc<Record<string, unknown>>) as Record<string, unknown>) : null,
    after: afterRow ? (stripDoc(afterRow as Doc<Record<string, unknown>>) as Record<string, unknown>) : null,
    diff:
      beforeRow && afterRow
        ? diff(
            stripDoc(beforeRow as Doc<Record<string, unknown>>) as Record<string, unknown>,
            stripDoc(afterRow as Doc<Record<string, unknown>>) as Record<string, unknown>,
          )
        : null,
    reason: null,
  }
  await addDoc('audit_events', event as unknown as Record<string, unknown>)
}

function hasRole(profile: Profile, roles: Role[]) {
  return roles.includes(profile.role)
}

function requireRole(profile: Profile, roles: Role[]) {
  if (!hasRole(profile, roles)) throw new HttpError(403, 'Forbidden', 'FORBIDDEN')
}

async function ensureProfile(headers: Record<string, string>, context?: CloudbaseContext): Promise<Profile> {
  const auth = app.auth()
  const authContext = context ? await auth.getAuthContext(context).catch(() => null) : null
  const userInfo = auth.getUserInfo()
  let uid = userInfo?.uid as string | undefined
  if (!uid && authContext?.uid) uid = authContext.uid as string

  if (!uid && process.env.ALLOW_DEV_AUTH_HEADER === 'true') {
    uid = headers['x-dev-user-id']
  }
  if (!uid) throw new HttpError(401, '未登录', 'UNAUTHENTICATED')

  const profileDoc = await db.collection('profiles').doc(uid).get().catch(() => null)
  const existing = ((profileDoc?.data ?? [])[0] ?? profileDoc?.data) as Profile | undefined
  if (existing?.id) {
    if (!existing.is_active) throw new HttpError(403, '账号已被停用', 'ACCOUNT_DISABLED')
    return existing
  }

  const endUser = await auth.getEndUserInfo(uid).catch(() => null)
  const email = endUser?.userInfo?.email || null
  const bootstrapAdmins = (process.env.BOOTSTRAP_ADMIN_EMAILS || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
  const role: Role = email && bootstrapAdmins.includes(email.toLowerCase()) ? 'admin' : 'viewer'
  const createdAt = nowIso()
  const profile: Profile = {
    id: uid,
    email,
    display_name: endUser?.userInfo?.nickName || email?.split('@')[0] || '用户',
    role,
    is_active: true,
    created_at: createdAt,
    updated_at: createdAt,
  }
  await db.collection('profiles').doc(uid).set(profile)
  return profile
}

function normalizeHeaders(input: unknown): Record<string, string> {
  const headers: Record<string, string> = {}
  if (!input || typeof input !== 'object') return headers
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    headers[key.toLowerCase()] = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
  }
  return headers
}

function parseBody(event: Record<string, unknown>) {
  const raw = event.body
  if (!raw) return {}
  const text =
    typeof raw === 'string' && event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : String(raw)
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, '请求体必须是 JSON', 'BAD_JSON')
  }
}

function parseQuery(event: Record<string, unknown>) {
  if (event.queryStringParameters && typeof event.queryStringParameters === 'object') {
    return event.queryStringParameters as Record<string, string>
  }
  if (event.query && typeof event.query === 'object') return event.query as Record<string, string>
  const raw = event.rawQueryString || event.queryString
  return Object.fromEntries(new URLSearchParams(String(raw ?? '')).entries())
}

function normalizeRequest(event: Record<string, unknown>) {
  const requestContext = event.requestContext as { http?: { method?: string; path?: string } } | undefined
  const method = String(event.httpMethod || event.method || requestContext?.http?.method || 'GET').toUpperCase() as Method
  const rawPath = String(event.path || event.rawPath || requestContext?.http?.path || '/')
  const path = rawPath.replace(/^\/api(?=\/|$)/, '') || '/'
  const headers = normalizeHeaders(event.headers)
  return {
    method,
    path,
    headers,
    query: parseQuery(event),
    body: parseBody(event),
  }
}

function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,x-request-id,x-dev-user-id',
    },
    body: JSON.stringify(body),
  }
}

function page<T>(items: T[], limitRaw?: string | number, offsetRaw?: string | number) {
  const limit = Math.min(Math.max(Number(limitRaw ?? 50) || 50, 1), 200)
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0)
  return items.slice(offset, offset + limit)
}

function orderByIdDesc<T extends { id: number }>(items: T[]) {
  return [...items].sort((a, b) => b.id - a.id)
}

async function validateProcessType(id: number | null) {
  if (id == null) return
  const row = await findById<ProcessType>('process_types', id)
  if (!row) throw new HttpError(409, '工艺类型不存在', 'FK_PROCESS_TYPE')
}

async function validateCuringAgent(id: number) {
  const row = await findById<CuringAgent>('curing_agents', id)
  if (!row) throw new HttpError(409, '固化剂不存在', 'FK_CURING_AGENT')
}

async function validateComposition(composition: unknown): Promise<CuringAgent['composition']> {
  if (composition == null || (Array.isArray(composition) && composition.length === 0)) return null
  if (!Array.isArray(composition)) throw new HttpError(400, 'composition must be an array', 'BAD_COMPOSITION')

  const seen = new Set<number>()
  let total = 0
  for (const item of composition) {
    const row = item as { material_id?: unknown; mass_pct?: unknown }
    const materialId = requiredNumber(row.material_id, 'material_id')
    const massPct = requiredNumber(row.mass_pct, 'mass_pct')
    if (massPct < 0 || massPct > 100) throw new HttpError(400, 'composition mass_pct must be between 0 and 100')
    if (seen.has(materialId)) throw new HttpError(400, 'composition material_id duplicated')
    if (!(await findById<Material>('materials', materialId))) throw new HttpError(409, `composition material_id not found: ${materialId}`)
    seen.add(materialId)
    total += massPct
  }
  if (Math.abs(total - 100) > 0.000001) throw new HttpError(400, 'composition mass_pct must sum to 100')
  return composition.map((item) => ({
    material_id: requiredNumber((item as { material_id: unknown }).material_id, 'material_id'),
    mass_pct: requiredNumber((item as { mass_pct: unknown }).mass_pct, 'mass_pct'),
  }))
}

function validateRecordNumbers(record: Pick<TrialRecord, 'ratio_a_pct' | 'ratio_b_pct' | 'bubble_grade'>) {
  if (record.ratio_a_pct < 0 || record.ratio_a_pct > 100) throw new HttpError(400, 'ratio_a_pct must be between 0 and 100')
  if (record.ratio_b_pct < 0 || record.ratio_b_pct > 100) throw new HttpError(400, 'ratio_b_pct must be between 0 and 100')
  if (record.ratio_a_pct + record.ratio_b_pct >= 100) throw new HttpError(400, 'ratio_a_pct + ratio_b_pct must be less than 100')
  if (record.bubble_grade < 0 || record.bubble_grade > 5) throw new HttpError(400, 'bubble_grade must be between 0 and 5')
}

function normalizeExperimentStatus(input: Partial<Experiment>) {
  const next = { ...input }
  next.status = next.status || '待开始'
  if (!['待开始', '进行中', '已结束'].includes(next.status)) throw new HttpError(400, '实验状态无效')
  if (next.status === '已结束') {
    if (!next.end_at || next.end_at === next.start_at) next.end_at = nowIso()
  } else {
    next.end_at = null
  }
  return next
}

async function listMaterials(query: Record<string, string>) {
  const rows = (await getAll<Material>('materials')).map(stripDoc)
  rows.sort((a, b) => a.category.localeCompare(b.category, 'zh-Hans-CN') || a.name.localeCompare(b.name, 'zh-Hans-CN'))
  return page(rows, query.limit ?? 200, query.offset ?? 0)
}

async function createMaterial(ctx: UserContext, body: Record<string, unknown>) {
  requireRole(ctx.profile, ['admin', 'editor'])
  const existing = (await getAll<Material>('materials')).find(
    (x) => x.category === body.category && x.name === body.name,
  )
  if (existing) throw new HttpError(409, '同分类原材料名称已存在', 'DUPLICATE_MATERIAL')
  const ts = nowIso()
  const row: Material = {
    id: nextId(),
    category: requiredString(body.category, '分类'),
    name: requiredString(body.name, '名称'),
    hydrogen_content: nullableNumber(body.hydrogen_content),
    vinyl_content: nullableNumber(body.vinyl_content),
    volatile_min: nullableNumber(body.volatile_min),
    volatile_max: nullableNumber(body.volatile_max),
    avg_mw_wan: nullableNumber(body.avg_mw_wan),
    pt_ppm: nullableNumber(body.pt_ppm),
    created_at: ts,
    updated_at: ts,
  }
  const created = await addDoc('materials', row as unknown as Record<string, unknown>)
  await audit(ctx, 'material.create', 'material', row.id, null, created)
  return stripDoc(created)
}

async function updateMaterial(ctx: UserContext, id: number, body: Record<string, unknown>) {
  requireRole(ctx.profile, ['admin', 'editor'])
  const existing = await findById<Material>('materials', id)
  if (!existing) throw new HttpError(404, '原材料不存在')
  const next: Material = {
    ...stripDoc(existing),
    ...cleanPayload({
      category: body.category == null ? undefined : requiredString(body.category, '分类'),
      name: body.name == null ? undefined : requiredString(body.name, '名称'),
      hydrogen_content: body.hydrogen_content === undefined ? undefined : nullableNumber(body.hydrogen_content),
      vinyl_content: body.vinyl_content === undefined ? undefined : nullableNumber(body.vinyl_content),
      volatile_min: body.volatile_min === undefined ? undefined : nullableNumber(body.volatile_min),
      volatile_max: body.volatile_max === undefined ? undefined : nullableNumber(body.volatile_max),
      avg_mw_wan: body.avg_mw_wan === undefined ? undefined : nullableNumber(body.avg_mw_wan),
      pt_ppm: body.pt_ppm === undefined ? undefined : nullableNumber(body.pt_ppm),
    }),
    updated_at: nowIso(),
  }
  const duplicate = (await getAll<Material>('materials')).find(
    (x) => x.id !== id && x.category === next.category && x.name === next.name,
  )
  if (duplicate) throw new HttpError(409, '同分类原材料名称已存在', 'DUPLICATE_MATERIAL')
  await updateByDocId('materials', existing._id, next as unknown as Record<string, unknown>)
  await audit(ctx, 'material.update', 'material', id, existing, next)
  return next
}

async function deleteMaterial(ctx: UserContext, id: number) {
  requireRole(ctx.profile, ['admin', 'editor'])
  const existing = await findById<Material>('materials', id)
  if (!existing) return null
  const agents = await getAll<CuringAgent>('curing_agents')
  if (agents.some((agent) => agent.composition?.some((item) => item.material_id === id))) {
    throw new HttpError(409, '原材料正在被固化剂组成使用', 'MATERIAL_IN_USE')
  }
  await removeByDocId('materials', existing._id)
  await audit(ctx, 'material.delete', 'material', id, existing, null)
  return null
}

async function listCuringAgents(query: Record<string, string>) {
  const records = await getAll<TrialRecord>('records')
  const rows = (await getAll<CuringAgent>('curing_agents')).map((agent) => ({
    ...stripDoc(agent),
    used_record_count: records.filter((r) => r.curing_agent_a_id === agent.id || r.curing_agent_b_id === agent.id).length,
  }))
  rows.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  return page(rows, query.limit ?? 200, query.offset ?? 0)
}

async function createCuringAgent(ctx: UserContext, body: Record<string, unknown>) {
  requireRole(ctx.profile, ['admin', 'editor'])
  const name = requiredString(body.name, '名称')
  if ((await getAll<CuringAgent>('curing_agents')).some((x) => x.name === name)) {
    throw new HttpError(409, '固化剂名称已存在', 'DUPLICATE_CURING_AGENT')
  }
  const ts = nowIso()
  const row: CuringAgent = {
    id: nextId(),
    name,
    default_ratio: nullableNumber(body.default_ratio),
    status: nullableString(body.status),
    note: nullableString(body.note),
    composition: await validateComposition(body.composition),
    created_at: ts,
    updated_at: ts,
  }
  const created = await addDoc('curing_agents', row as unknown as Record<string, unknown>)
  await audit(ctx, 'curing_agent.create', 'curing_agent', row.id, null, created)
  return { ...stripDoc(created), used_record_count: 0 }
}

async function updateCuringAgent(ctx: UserContext, id: number, body: Record<string, unknown>) {
  requireRole(ctx.profile, ['admin', 'editor'])
  const existing = await findById<CuringAgent>('curing_agents', id)
  if (!existing) throw new HttpError(404, '固化剂不存在')
  const next: CuringAgent = {
    ...stripDoc(existing),
    ...cleanPayload({
      name: body.name == null ? undefined : requiredString(body.name, '名称'),
      default_ratio: body.default_ratio === undefined ? undefined : nullableNumber(body.default_ratio),
      status: body.status === undefined ? undefined : nullableString(body.status),
      note: body.note === undefined ? undefined : nullableString(body.note),
      composition: body.composition === undefined ? undefined : await validateComposition(body.composition),
    }),
    updated_at: nowIso(),
  }
  if ((await getAll<CuringAgent>('curing_agents')).some((x) => x.id !== id && x.name === next.name)) {
    throw new HttpError(409, '固化剂名称已存在', 'DUPLICATE_CURING_AGENT')
  }
  await updateByDocId('curing_agents', existing._id, next as unknown as Record<string, unknown>)
  await audit(ctx, 'curing_agent.update', 'curing_agent', id, existing, next)
  const used = (await getAll<TrialRecord>('records')).filter((r) => r.curing_agent_a_id === id || r.curing_agent_b_id === id).length
  return { ...next, used_record_count: used }
}

async function deleteCuringAgent(ctx: UserContext, id: number) {
  requireRole(ctx.profile, ['admin', 'editor'])
  if ((await getAll<TrialRecord>('records')).some((r) => r.curing_agent_a_id === id || r.curing_agent_b_id === id)) {
    throw new HttpError(409, '固化剂已被记录使用', 'CURING_AGENT_IN_USE')
  }
  const existing = await findById<CuringAgent>('curing_agents', id)
  if (!existing) return null
  await removeByDocId('curing_agents', existing._id)
  await audit(ctx, 'curing_agent.delete', 'curing_agent', id, existing, null)
  return null
}

async function listExperiments(query: Record<string, string>) {
  const rows = orderByIdDesc((await getAll<Experiment>('experiments')).map(stripDoc)).filter((e) => {
    const q = (query.q || '').trim().toLowerCase()
    return (
      (!query.process_type_id || e.process_type_id === Number(query.process_type_id)) &&
      (!query.status || e.status === query.status) &&
      (!q ||
        e.customer_name.toLowerCase().includes(q) ||
        e.project_no.toLowerCase().includes(q) ||
        e.silicone_model.toLowerCase().includes(q))
    )
  })
  if (query.curing_agent_id) {
    const agentId = Number(query.curing_agent_id)
    const records = await getAll<TrialRecord>('records')
    return page(
      rows.filter((e) =>
        records.some((r) => r.experiment_id === e.id && (r.curing_agent_a_id === agentId || r.curing_agent_b_id === agentId)),
      ),
      query.limit,
      query.offset,
    )
  }
  return page(rows, query.limit, query.offset)
}

async function createExperiment(ctx: UserContext, body: Record<string, unknown>) {
  requireRole(ctx.profile, ['admin', 'editor'])
  const processTypeId = requiredNumber(body.process_type_id, '工艺类型')
  await validateProcessType(processTypeId)
  const ts = nowIso()
  const row = normalizeExperimentStatus({
    id: nextId(),
    customer_name: requiredString(body.customer_name, '客户名称'),
    project_no: requiredString(body.project_no, '项目号'),
    status: nullableString(body.status) || '待开始',
    debug_goal: nullableString(body.debug_goal),
    silicone_model: requiredString(body.silicone_model, '硅胶型号'),
    process_type_id: processTypeId,
    final_record_id: nullableNumber(body.final_record_id),
    start_at: requiredString(body.start_at, '开始时间'),
    end_at: nullableString(body.end_at),
    cure_temp_c: nullableNumber(body.cure_temp_c),
    cure_time_min: nullableNumber(body.cure_time_min),
    bake_temp_c: nullableNumber(body.bake_temp_c),
    bake_time_min: nullableNumber(body.bake_time_min),
    sheet_thickness_mm: nullableNumber(body.sheet_thickness_mm),
    note: nullableString(body.note),
    created_at: ts,
    updated_at: ts,
  }) as Experiment
  const created = await addDoc('experiments', row as unknown as Record<string, unknown>)
  await audit(ctx, 'experiment.create', 'experiment', row.id, null, created)
  return stripDoc(created)
}

async function updateExperiment(ctx: UserContext, id: number, body: Record<string, unknown>) {
  requireRole(ctx.profile, ['admin', 'editor'])
  const existing = await findById<Experiment>('experiments', id)
  if (!existing) throw new HttpError(404, 'Experiment not found')
  if (body.process_type_id !== undefined) await validateProcessType(requiredNumber(body.process_type_id, '工艺类型'))
  if (body.final_record_id != null) {
    const finalRecord = await findById<TrialRecord>('records', Number(body.final_record_id))
    if (!finalRecord) throw new HttpError(409, 'final_record_id not found')
    if (finalRecord.experiment_id !== id) throw new HttpError(400, 'final_record_id must belong to the experiment')
  }
  const next = normalizeExperimentStatus({
    ...stripDoc(existing),
    ...cleanPayload({
      customer_name: body.customer_name == null ? undefined : requiredString(body.customer_name, '客户名称'),
      project_no: body.project_no == null ? undefined : requiredString(body.project_no, '项目号'),
      status: body.status === undefined ? undefined : nullableString(body.status),
      debug_goal: body.debug_goal === undefined ? undefined : nullableString(body.debug_goal),
      silicone_model: body.silicone_model == null ? undefined : requiredString(body.silicone_model, '硅胶型号'),
      process_type_id: body.process_type_id === undefined ? undefined : requiredNumber(body.process_type_id, '工艺类型'),
      final_record_id: body.final_record_id === undefined ? undefined : nullableNumber(body.final_record_id),
      start_at: body.start_at == null ? undefined : requiredString(body.start_at, '开始时间'),
      end_at: body.end_at === undefined ? undefined : nullableString(body.end_at),
      cure_temp_c: body.cure_temp_c === undefined ? undefined : nullableNumber(body.cure_temp_c),
      cure_time_min: body.cure_time_min === undefined ? undefined : nullableNumber(body.cure_time_min),
      bake_temp_c: body.bake_temp_c === undefined ? undefined : nullableNumber(body.bake_temp_c),
      bake_time_min: body.bake_time_min === undefined ? undefined : nullableNumber(body.bake_time_min),
      sheet_thickness_mm: body.sheet_thickness_mm === undefined ? undefined : nullableNumber(body.sheet_thickness_mm),
      note: body.note === undefined ? undefined : nullableString(body.note),
    }),
    updated_at: nowIso(),
  }) as Experiment
  await updateByDocId('experiments', existing._id, next as unknown as Record<string, unknown>)
  await audit(ctx, 'experiment.update', 'experiment', id, existing, next)
  return next
}

async function deleteExperiment(ctx: UserContext, id: number) {
  requireRole(ctx.profile, ['admin', 'editor'])
  const existing = await findById<Experiment>('experiments', id)
  if (!existing) throw new HttpError(404, 'Experiment not found')
  for (const record of (await getAll<TrialRecord>('records')).filter((r) => r.experiment_id === id)) {
    await removeByDocId('records', record._id)
  }
  await removeByDocId('experiments', existing._id)
  await audit(ctx, 'experiment.delete', 'experiment', id, existing, null)
  return null
}

async function listRecords(query: Record<string, string>) {
  const experiments = await getAll<Experiment>('experiments')
  const rows = orderByIdDesc((await getAll<TrialRecord>('records')).map(stripDoc)).filter((r) => {
    const exp = experiments.find((e) => e.id === r.experiment_id)
    return (
      (!query.experiment_id || r.experiment_id === Number(query.experiment_id)) &&
      (!query.process_type_id || (exp && (r.process_type_id ?? exp.process_type_id) === Number(query.process_type_id)))
    )
  })
  return page(rows, query.limit, query.offset)
}

async function createRecord(ctx: UserContext, body: Record<string, unknown>) {
  requireRole(ctx.profile, ['admin', 'editor'])
  const experimentId = requiredNumber(body.experiment_id, '实验')
  const experiment = await findById<Experiment>('experiments', experimentId)
  if (!experiment) throw new HttpError(409, '实验不存在')
  const processTypeId = body.process_type_id === undefined ? null : nullableNumber(body.process_type_id)
  await validateProcessType(processTypeId)
  const ts = nowIso()
  const row: TrialRecord = {
    id: nextId(),
    experiment_id: experimentId,
    process_type_id: processTypeId,
    curing_agent_a_id: requiredNumber(body.curing_agent_a_id, '固化剂A'),
    curing_agent_b_id: requiredNumber(body.curing_agent_b_id, '固化剂B'),
    ratio_a_pct: requiredNumber(body.ratio_a_pct, 'A比例'),
    ratio_b_pct: requiredNumber(body.ratio_b_pct, 'B比例'),
    ml: requiredNumber(body.ml, 'ML'),
    mh: requiredNumber(body.mh, 'MH'),
    t10_sec: requiredNumber(body.t10_sec, 'T10'),
    t90_sec: requiredNumber(body.t90_sec, 'T90'),
    bubble_grade: requiredNumber(body.bubble_grade, '气泡等级'),
    note: nullableString(body.note),
    cure_temp_c: nullableNumber(body.cure_temp_c),
    cure_time_min: nullableNumber(body.cure_time_min),
    bake_temp_c: nullableNumber(body.bake_temp_c),
    bake_time_min: nullableNumber(body.bake_time_min),
    sheet_thickness_mm: nullableNumber(body.sheet_thickness_mm),
    created_at: ts,
    updated_at: ts,
  }
  validateRecordNumbers(row)
  await validateCuringAgent(row.curing_agent_a_id)
  await validateCuringAgent(row.curing_agent_b_id)
  const created = await addDoc('records', row as unknown as Record<string, unknown>)
  if (experiment.status === '待开始') {
    await updateByDocId('experiments', experiment._id, { status: '进行中', end_at: null, updated_at: nowIso() })
  }
  await audit(ctx, 'record.create', 'record', row.id, null, created)
  return stripDoc(created)
}

async function updateRecord(ctx: UserContext, id: number, body: Record<string, unknown>) {
  requireRole(ctx.profile, ['admin', 'editor'])
  const existing = await findById<TrialRecord>('records', id)
  if (!existing) throw new HttpError(404, '记录不存在')
  if (body.experiment_id !== undefined) {
    const experiment = await findById<Experiment>('experiments', requiredNumber(body.experiment_id, '实验'))
    if (!experiment) throw new HttpError(409, '实验不存在')
  }
  const processTypeId = body.process_type_id === undefined ? undefined : nullableNumber(body.process_type_id)
  if (processTypeId !== undefined) await validateProcessType(processTypeId)
  const next: TrialRecord = {
    ...stripDoc(existing),
    ...cleanPayload({
      experiment_id: body.experiment_id === undefined ? undefined : requiredNumber(body.experiment_id, '实验'),
      process_type_id: processTypeId,
      curing_agent_a_id: body.curing_agent_a_id === undefined ? undefined : requiredNumber(body.curing_agent_a_id, '固化剂A'),
      curing_agent_b_id: body.curing_agent_b_id === undefined ? undefined : requiredNumber(body.curing_agent_b_id, '固化剂B'),
      ratio_a_pct: body.ratio_a_pct === undefined ? undefined : requiredNumber(body.ratio_a_pct, 'A比例'),
      ratio_b_pct: body.ratio_b_pct === undefined ? undefined : requiredNumber(body.ratio_b_pct, 'B比例'),
      ml: body.ml === undefined ? undefined : requiredNumber(body.ml, 'ML'),
      mh: body.mh === undefined ? undefined : requiredNumber(body.mh, 'MH'),
      t10_sec: body.t10_sec === undefined ? undefined : requiredNumber(body.t10_sec, 'T10'),
      t90_sec: body.t90_sec === undefined ? undefined : requiredNumber(body.t90_sec, 'T90'),
      bubble_grade: body.bubble_grade === undefined ? undefined : requiredNumber(body.bubble_grade, '气泡等级'),
      note: body.note === undefined ? undefined : nullableString(body.note),
      cure_temp_c: body.cure_temp_c === undefined ? undefined : nullableNumber(body.cure_temp_c),
      cure_time_min: body.cure_time_min === undefined ? undefined : nullableNumber(body.cure_time_min),
      bake_temp_c: body.bake_temp_c === undefined ? undefined : nullableNumber(body.bake_temp_c),
      bake_time_min: body.bake_time_min === undefined ? undefined : nullableNumber(body.bake_time_min),
      sheet_thickness_mm: body.sheet_thickness_mm === undefined ? undefined : nullableNumber(body.sheet_thickness_mm),
    }),
    updated_at: nowIso(),
  }
  validateRecordNumbers(next)
  await validateCuringAgent(next.curing_agent_a_id)
  await validateCuringAgent(next.curing_agent_b_id)
  await updateByDocId('records', existing._id, next as unknown as Record<string, unknown>)
  await audit(ctx, 'record.update', 'record', id, existing, next)
  return next
}

async function deleteRecord(ctx: UserContext, id: number) {
  requireRole(ctx.profile, ['admin', 'editor'])
  const existing = await findById<TrialRecord>('records', id)
  if (!existing) return null
  const experiments = await getAll<Experiment>('experiments')
  for (const exp of experiments.filter((x) => x.final_record_id === id)) {
    await updateByDocId('experiments', exp._id, { final_record_id: null, updated_at: nowIso() })
  }
  await removeByDocId('records', existing._id)
  await audit(ctx, 'record.delete', 'record', id, existing, null)
  return null
}

async function experimentSuggestions(query: Record<string, string>) {
  const limit = Math.min(Math.max(Number(query.limit ?? 200) || 200, 1), 500)
  const rows = await getAll<Experiment>('experiments')
  const top = (field: 'customer_name' | 'silicone_model') => {
    const counts = new Map<string, number>()
    for (const row of rows) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1)
    const values = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN')).slice(0, limit).map(([value]) => value)
    return values.includes('其它') ? values : [...values, '其它']
  }
  return { customers: top('customer_name'), silicone_models: top('silicone_model') }
}

async function dashboardStats(query: Record<string, string>) {
  const completedDays = Math.min(Math.max(Number(query.completed_days ?? 7) || 7, 1), 3650)
  const topN = Math.min(Math.max(Number(query.top_n ?? 5) || 5, 1), 20)
  const completedSince = Date.now() - completedDays * 24 * 60 * 60 * 1000
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  const [records, agents, experiments] = await Promise.all([
    getAll<TrialRecord>('records'),
    getAll<CuringAgent>('curing_agents'),
    getAll<Experiment>('experiments'),
  ])
  const agentName = (id: number) => agents.find((a) => a.id === id)?.name ?? ''
  const top = (field: 'curing_agent_a_id' | 'curing_agent_b_id') => {
    const counts = new Map<number, number>()
    for (const record of records) counts.set(record[field], (counts.get(record[field]) ?? 0) + 1)
    const rows = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([curing_agent_id, count]) => ({ curing_agent_id, name: agentName(curing_agent_id), count }))
    const topSum = rows.reduce((sum, row) => sum + row.count, 0)
    return { rows, other: Math.max(0, records.length - topSum) }
  }
  const a = top('curing_agent_a_id')
  const b = top('curing_agent_b_id')
  return {
    curing_agents_a_top: a.rows,
    curing_agents_a_other_count: a.other,
    curing_agents_b_top: b.rows,
    curing_agents_b_other_count: b.other,
    ongoing_experiments_count: experiments.filter((e) => e.status === '进行中').length,
    completed_experiments_count: experiments.filter((e) => e.status === '已结束' && e.end_at && Date.parse(e.end_at) >= completedSince).length,
    new_experiments_this_week_count: experiments.filter((e) => Date.parse(e.created_at) >= weekStart.getTime()).length,
  }
}

async function listAuditEvents(ctx: UserContext, query: Record<string, string>) {
  requireRole(ctx.profile, ['admin', 'auditor'])
  const rows = orderByIdDesc((await getAll<AuditEvent>('audit_events')).map(stripDoc)).filter((e) => {
    return (
      (!query.ts_from || e.ts >= query.ts_from) &&
      (!query.ts_to || e.ts <= query.ts_to) &&
      (!query.actor_id || e.actor_id === query.actor_id) &&
      (!query.entity_type || e.entity_type === query.entity_type) &&
      (!query.entity_id || e.entity_id === query.entity_id) &&
      (!query.action || e.action === query.action)
    )
  })
  return { items: page(rows, query.limit, query.offset), total: rows.length }
}

async function exportRecordsRows(query: Record<string, string>) {
  const [records, experiments, processTypes, agents] = await Promise.all([
    getAll<TrialRecord>('records'),
    getAll<Experiment>('experiments'),
    getAll<ProcessType>('process_types'),
    getAll<CuringAgent>('curing_agents'),
  ])
  const ptName = (id: number) => processTypes.find((x) => x.id === id)?.name ?? null
  const agentName = (id: number) => agents.find((x) => x.id === id)?.name ?? null
  const rows = orderByIdDesc(records.map(stripDoc)).flatMap((r) => {
    const e = experiments.find((x) => x.id === r.experiment_id)
    if (!e) return []
    const effectiveProcessTypeId = r.process_type_id ?? e.process_type_id
    const match =
      (!query.experiment_id || r.experiment_id === Number(query.experiment_id)) &&
      (!query.process_type_id || effectiveProcessTypeId === Number(query.process_type_id)) &&
      (!query.status || e.status === query.status) &&
      (!query.curing_agent_id || r.curing_agent_a_id === Number(query.curing_agent_id) || r.curing_agent_b_id === Number(query.curing_agent_id)) &&
      (!query.customer_q || e.customer_name.includes(query.customer_q)) &&
      (!query.silicone_model_q || e.silicone_model.includes(query.silicone_model_q)) &&
      (!query.project_no_q || e.project_no.includes(query.project_no_q)) &&
      (!query.start_from || e.start_at >= query.start_from) &&
      (!query.start_to || e.start_at <= query.start_to) &&
      (query.only_final !== 'true' || e.final_record_id === r.id)
    if (!match) return []
    return [{
      record_id: r.id,
      experiment_id: r.experiment_id,
      effective_process_type_id: effectiveProcessTypeId,
      process_type_name: ptName(effectiveProcessTypeId),
      is_final: e.final_record_id === r.id,
      curing_agent_a_id: r.curing_agent_a_id,
      curing_agent_a_name: agentName(r.curing_agent_a_id),
      ratio_a_pct: r.ratio_a_pct,
      curing_agent_b_id: r.curing_agent_b_id,
      curing_agent_b_name: agentName(r.curing_agent_b_id),
      ratio_b_pct: r.ratio_b_pct,
      ml: r.ml,
      mh: r.mh,
      t10_sec: r.t10_sec,
      t90_sec: r.t90_sec,
      bubble_grade: r.bubble_grade,
      record_note: r.note,
      record_created_at: r.created_at,
      record_updated_at: r.updated_at,
      customer_name: e.customer_name,
      project_no: e.project_no,
      silicone_model: e.silicone_model,
      debug_goal: e.debug_goal,
      experiment_start_at: e.start_at,
      experiment_end_at: e.end_at,
      experiment_note: e.note,
      experiment_created_at: e.created_at,
      experiment_updated_at: e.updated_at,
    }]
  })
  return rows.slice(0, Math.min(Math.max(Number(query.limit ?? 20000) || 20000, 1), 20000))
}

async function exportExperimentsRows(query: Record<string, string>) {
  const [experiments, processTypes, records] = await Promise.all([
    getAll<Experiment>('experiments'),
    getAll<ProcessType>('process_types'),
    getAll<TrialRecord>('records'),
  ])
  const rows = orderByIdDesc(experiments.map(stripDoc)).filter((e) => {
    return (
      (!query.process_type_id || e.process_type_id === Number(query.process_type_id)) &&
      (!query.status || e.status === query.status) &&
      (!query.curing_agent_id ||
        records.some(
          (r) =>
            r.experiment_id === e.id &&
            (r.curing_agent_a_id === Number(query.curing_agent_id) || r.curing_agent_b_id === Number(query.curing_agent_id)),
        )) &&
      (!query.customer_q || e.customer_name.includes(query.customer_q)) &&
      (!query.silicone_model_q || e.silicone_model.includes(query.silicone_model_q)) &&
      (!query.project_no_q || e.project_no.includes(query.project_no_q)) &&
      (!query.start_from || e.start_at >= query.start_from) &&
      (!query.start_to || e.start_at <= query.start_to)
    )
  })
  return rows.map((e) => ({
    experiment_id: e.id,
    customer_name: e.customer_name,
    project_no: e.project_no,
    silicone_model: e.silicone_model,
    debug_goal: e.debug_goal,
    process_type_id: e.process_type_id,
    process_type_name: processTypes.find((pt) => pt.id === e.process_type_id)?.name ?? null,
    start_at: e.start_at,
    end_at: e.end_at,
    note: e.note,
    created_at: e.created_at,
    updated_at: e.updated_at,
  }))
}

async function route(req: ReturnType<typeof normalizeRequest>, context?: CloudbaseContext) {
  if (req.method === 'OPTIONS') return response(204, null)
  const ctx: UserContext = {
    profile: await ensureProfile(req.headers, context),
    request_id: req.headers['x-request-id'] || null,
    ip: req.headers['x-forwarded-for'] || null,
    user_agent: req.headers['user-agent'] || null,
  }

  const segments = req.path.split('/').filter(Boolean)
  const id = segments[1] ? Number(segments[1]) : null

  if (req.method === 'GET' && req.path === '/me') return response(200, ctx.profile)
  if (req.method === 'GET' && req.path === '/process-types') {
    const rows = (await getAll<ProcessType>('process_types')).map(stripDoc).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
    return response(200, rows)
  }
  if (segments[0] === 'materials') {
    if (req.method === 'GET' && segments.length === 1) return response(200, await listMaterials(req.query))
    if (req.method === 'POST' && segments.length === 1) return response(200, await createMaterial(ctx, req.body))
    if (req.method === 'PATCH' && id) return response(200, await updateMaterial(ctx, id, req.body))
    if (req.method === 'DELETE' && id) return response(204, await deleteMaterial(ctx, id))
  }
  if (segments[0] === 'curing-agents') {
    if (req.method === 'GET' && segments.length === 1) return response(200, await listCuringAgents(req.query))
    if (req.method === 'POST' && segments.length === 1) return response(200, await createCuringAgent(ctx, req.body))
    if (req.method === 'PATCH' && id) return response(200, await updateCuringAgent(ctx, id, req.body))
    if (req.method === 'DELETE' && id) return response(204, await deleteCuringAgent(ctx, id))
  }
  if (segments[0] === 'experiments') {
    if (req.method === 'GET' && segments.length === 1) return response(200, await listExperiments(req.query))
    if (req.method === 'POST' && segments.length === 1) return response(200, await createExperiment(ctx, req.body))
    if (req.method === 'GET' && id) {
      const row = await findById<Experiment>('experiments', id)
      if (!row) throw new HttpError(404, 'Experiment not found')
      return response(200, stripDoc(row))
    }
    if (req.method === 'PATCH' && id) return response(200, await updateExperiment(ctx, id, req.body))
    if (req.method === 'DELETE' && id) return response(204, await deleteExperiment(ctx, id))
  }
  if (segments[0] === 'records') {
    if (req.method === 'GET') return response(200, await listRecords(req.query))
    if (req.method === 'POST') return response(200, await createRecord(ctx, req.body))
    if (req.method === 'PATCH' && id) return response(200, await updateRecord(ctx, id, req.body))
    if (req.method === 'DELETE' && id) return response(204, await deleteRecord(ctx, id))
  }
  if (req.method === 'GET' && req.path === '/experiment-suggestions') return response(200, await experimentSuggestions(req.query))
  if (req.method === 'GET' && req.path === '/dashboard-stats') return response(200, await dashboardStats(req.query))
  if (req.method === 'GET' && req.path === '/audit-events') return response(200, await listAuditEvents(ctx, req.query))
  if (req.method === 'GET' && req.path === '/exports/records') return response(200, await exportRecordsRows(req.query))
  if (req.method === 'GET' && req.path === '/exports/experiments') return response(200, await exportExperimentsRows(req.query))

  throw new HttpError(404, 'Not found', 'NOT_FOUND')
}

async function ensureCollections() {
  if (process.env.SKIP_COLLECTION_CHECK === 'true') return
  const database = db
  await Promise.all(
    COLLECTIONS.map((name) =>
      database
        .createCollection(name)
        .catch((error: { code?: string; message?: string }) => {
          if (String(error.code || error.message).includes('already')) return null
          return null
        }),
    ),
  )
}

export async function main(event: Record<string, unknown>, context?: CloudbaseContext) {
  try {
    await ensureCollections()
    const req = normalizeRequest(event)
    return await route(req, context)
  } catch (error) {
    if (error instanceof HttpError) {
      return response(error.status, {
        detail: error.message,
        code: error.code,
        details: error.details,
      })
    }
    console.error(error)
    return response(500, { detail: '服务器错误' })
  }
}

exports.main = main
