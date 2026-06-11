import { getCsrfToken } from './prefs'

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

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

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const detail = await parseJsonSafe(res)
    throw new ApiError('Request failed', res.status, detail)
  }
  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const csrf = getCsrfToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await parseJsonSafe(res)
    throw new ApiError('Request failed', res.status, detail)
  }
  return (await res.json()) as T
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const csrf = getCsrfToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await parseJsonSafe(res)
    throw new ApiError('Request failed', res.status, detail)
  }
  return (await res.json()) as T
}

export async function apiDelete(path: string): Promise<void> {
  const csrf = getCsrfToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
  })
  if (!res.ok) {
    const detail = await parseJsonSafe(res)
    throw new ApiError('Request failed', res.status, detail)
  }
}

