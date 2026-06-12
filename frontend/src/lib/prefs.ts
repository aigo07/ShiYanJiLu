const SKIP_EXPERIMENT_DELETE_CONFIRM_KEY = 'skipExperimentDeleteConfirm'
const TABLE_DENSITY_KEY = 'tableDensity'

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore storage failures; never block primary actions
  }
}

function safeRemoveItem(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function getSkipExperimentDeleteConfirm(): boolean {
  const v = safeGetItem(SKIP_EXPERIMENT_DELETE_CONFIRM_KEY)
  return v === '1' || v === 'true'
}

export function setSkipExperimentDeleteConfirm(next: boolean): void {
  safeSetItem(SKIP_EXPERIMENT_DELETE_CONFIRM_KEY, next ? '1' : '0')
}

export function clearSkipExperimentDeleteConfirm(): void {
  safeRemoveItem(SKIP_EXPERIMENT_DELETE_CONFIRM_KEY)
}

export type TableDensity = 'comfortable' | 'compact'

export function getTableDensity(): TableDensity {
  const v = safeGetItem(TABLE_DENSITY_KEY)
  return v === 'compact' ? 'compact' : 'comfortable'
}

export function setTableDensity(next: TableDensity): void {
  safeSetItem(TABLE_DENSITY_KEY, next)
}

