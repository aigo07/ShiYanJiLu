export type ProcessType = {
  id: number
  name: string
  created_at?: string
  updated_at?: string
}

export type Experiment = {
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
  created_at?: string
  updated_at?: string
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
  cure_temp_c: number | null
  cure_time_min: number | null
  bake_temp_c: number | null
  bake_time_min: number | null
  sheet_thickness_mm: number | null
  created_at?: string
  updated_at?: string
}

export type CuringAgent = {
  id: number
  name: string
  default_ratio: number | null
  status: string | null
  note: string | null
  composition?: Array<{ material_id: number; mass_pct: number }> | null
  used_record_count?: number
  created_at?: string
  updated_at?: string
}

export type Material = {
  id: number
  category: string
  name: string
  hydrogen_content: number | null
  vinyl_content: number | null
  volatile_min: number | null
  volatile_max: number | null
  avg_mw_wan: number | null
  pt_ppm: number | null
  created_at?: string
  updated_at?: string
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

export type ExperimentSuggestions = {
  customers: string[]
  silicone_models: string[]
}

export type CuringAgentTopItem = {
  curing_agent_id: number
  name: string
  count: number
}

export type DashboardStats = {
  curing_agents_a_top: CuringAgentTopItem[]
  curing_agents_a_other_count: number
  curing_agents_b_top: CuringAgentTopItem[]
  curing_agents_b_other_count: number
  ongoing_experiments_count: number
  completed_experiments_count: number
  new_experiments_this_week_count: number
}

export type ExportRecordRow = {
  record_id: number
  experiment_id: number
  effective_process_type_id: number
  process_type_name: string | null
  is_final: boolean
  curing_agent_a_id: number
  curing_agent_a_name: string | null
  ratio_a_pct: number
  curing_agent_b_id: number
  curing_agent_b_name: string | null
  ratio_b_pct: number
  ml: number
  mh: number
  t10_sec: number
  t90_sec: number
  bubble_grade: number
  record_note: string | null
  record_created_at: string
  record_updated_at: string
  customer_name: string
  project_no: string
  silicone_model: string
  debug_goal: string | null
  experiment_start_at: string
  experiment_end_at: string | null
  experiment_note: string | null
  experiment_created_at: string
  experiment_updated_at: string
}

export type ExportExperimentRow = {
  experiment_id: number
  customer_name: string
  project_no: string
  silicone_model: string
  debug_goal: string | null
  process_type_id: number
  process_type_name: string | null
  start_at: string
  end_at: string | null
  note: string | null
  created_at: string
  updated_at: string
}
