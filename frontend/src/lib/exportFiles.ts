import JSZip from 'jszip'
import {
  getExportExperimentsRows,
  getExportRecordsRows,
  type ExportFilters,
} from './data'
import type { ExportExperimentRow, ExportRecordRow } from './types'

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
}

function fmtDt(value: string | null | undefined): string {
  if (!value) return ''
  return value
}

function csvCell(value: unknown): string {
  if (value == null) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsv(headers: string[], rows: unknown[][]): Uint8Array {
  const body = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
  return new TextEncoder().encode(`\ufeff${body}\n`)
}

function downloadBytes(bytes: Blob | Uint8Array, filename: string, type: string) {
  let part: Blob | ArrayBuffer
  if (bytes instanceof Uint8Array) {
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    part = copy.buffer
  } else {
    part = bytes
  }
  const blob = part instanceof Blob ? part : new Blob([part], { type })
  const a = document.createElement('a')
  const objectUrl = URL.createObjectURL(blob)
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

function recordsCsv(rows: ExportRecordRow[]): Uint8Array {
  return toCsv(
    [
      '记录ID',
      '实验ID',
      '工艺类型ID（生效）',
      '工艺类型',
      '是否最终',
      '硫化剂A_ID',
      '硫化剂A',
      'A比例（%）',
      '硫化剂B_ID',
      '硫化剂B',
      'B比例（%）',
      'ML',
      'MH',
      'T10（秒）',
      'T90（秒）',
      '气泡等级',
      '记录备注',
      '记录创建时间',
      '记录更新时间',
      '客户',
      '项目号',
      '硅胶型号',
      '调试目标',
      '实验开始时间',
      '实验结束时间',
      '实验备注',
      '实验创建时间',
      '实验更新时间',
    ],
    rows.map((r) => [
      r.record_id,
      r.experiment_id,
      r.effective_process_type_id,
      r.process_type_name,
      r.is_final ? 1 : 0,
      r.curing_agent_a_id,
      r.curing_agent_a_name,
      r.ratio_a_pct,
      r.curing_agent_b_id,
      r.curing_agent_b_name,
      r.ratio_b_pct,
      r.ml,
      r.mh,
      r.t10_sec,
      r.t90_sec,
      r.bubble_grade,
      r.record_note,
      fmtDt(r.record_created_at),
      fmtDt(r.record_updated_at),
      r.customer_name,
      r.project_no,
      r.silicone_model,
      r.debug_goal,
      fmtDt(r.experiment_start_at),
      fmtDt(r.experiment_end_at),
      r.experiment_note,
      fmtDt(r.experiment_created_at),
      fmtDt(r.experiment_updated_at),
    ]),
  )
}

function experimentsCsv(rows: ExportExperimentRow[]): Uint8Array {
  return toCsv(
    [
      '实验ID',
      '客户',
      '项目号',
      '硅胶型号',
      '调试目标',
      '工艺类型ID',
      '工艺类型',
      '开始时间',
      '结束时间',
      '备注',
      '创建时间',
      '更新时间',
    ],
    rows.map((r) => [
      r.experiment_id,
      r.customer_name,
      r.project_no,
      r.silicone_model,
      r.debug_goal,
      r.process_type_id,
      r.process_type_name,
      fmtDt(r.start_at),
      fmtDt(r.end_at),
      r.note,
      fmtDt(r.created_at),
      fmtDt(r.updated_at),
    ]),
  )
}

export async function downloadRecordsCsv(filters: ExportFilters): Promise<void> {
  const rows = await getExportRecordsRows(filters)
  downloadBytes(recordsCsv(rows), `记录导出_${timestamp()}.csv`, 'text/csv;charset=utf-8')
}

export async function downloadExperimentsRecordsZip(filters: ExportFilters): Promise<void> {
  const [experiments, records] = await Promise.all([
    getExportExperimentsRows(filters),
    getExportRecordsRows(filters),
  ])
  const zip = new JSZip()
  zip.file('实验_列表.csv', experimentsCsv(experiments))
  zip.file('实验_记录明细.csv', recordsCsv(records))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  downloadBytes(blob, `实验+记录导出_${timestamp()}.zip`, 'application/zip')
}
