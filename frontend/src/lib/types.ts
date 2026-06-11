export type ProcessType = {
  id: number
  name: string
}

export type Experiment = {
  id: number
  customer_name: string
  project_no: string
  status: string
  debug_goal: string
  silicone_model: string
  process_type_id: number
  final_record_id: number | null
  start_at: string
  end_at: string | null
  note: string | null
}

export type Record = {
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
}

export type CuringAgent = {
  id: number
  name: string
  default_ratio: number | null
  status: string | null
  note: string | null
  composition?: Array<{ material_id: number; mass_pct: number }> | null
  used_record_count?: number
}

export type AuditEvent = {
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
  before: { [k: string]: unknown } | null
  after: { [k: string]: unknown } | null
  diff: { [k: string]: unknown } | null
  reason: string | null
}

export type AuditEventList = {
  items: AuditEvent[]
  total: number
}

