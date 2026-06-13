import { getCloudbaseAccessToken } from './cloudbase'

const cloudbaseEnvId = import.meta.env.VITE_CLOUDBASE_ENV_ID
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (cloudbaseEnvId ? `https://${cloudbaseEnvId}.api.tcloudbasegateway.com` : '')
const functionName = import.meta.env.VITE_CLOUDBASE_FUNCTION_NAME || 'shiyanjilu-api'

if (!apiBaseUrl) {
  console.error('Missing VITE_API_BASE_URL')
}

export type ApiErrorDetail = {
  detail?: unknown
  code?: string
  details?: unknown
  hint?: unknown
}

type FunctionHttpResponse = {
  statusCode: number
  headers?: Record<string, string>
  body?: string
}

function functionEndpoint() {
  const base = String(apiBaseUrl || '').replace(/\/$/, '')
  if (base.includes('/v1/functions/')) return base
  return `${base}/v1/functions/${functionName}`
}

function parseJsonMaybe(text: string) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function isFunctionHttpResponse(value: unknown): value is FunctionHttpResponse {
  return Boolean(value && typeof value === 'object' && 'statusCode' in value)
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getCloudbaseAccessToken()
  const outboundHeaders = new Headers()
  outboundHeaders.set('content-type', 'application/json')
  if (token) outboundHeaders.set('authorization', `Bearer ${token}`)

  const inputHeaders = new Headers(init.headers)
  const requestUrl = new URL(path, 'https://local.invalid')
  const res = await fetch(functionEndpoint(), {
    method: 'POST',
    headers: outboundHeaders,
    body: JSON.stringify({
      httpMethod: init.method || 'GET',
      path: requestUrl.pathname,
      rawPath: requestUrl.pathname,
      rawQueryString: requestUrl.search.replace(/^\?/, ''),
      queryStringParameters: Object.fromEntries(requestUrl.searchParams.entries()),
      headers: Object.fromEntries(inputHeaders.entries()),
      body: typeof init.body === 'string' ? init.body : init.body ? String(init.body) : '',
    }),
  })

  const text = await res.text()
  const data = parseJsonMaybe(text)
  if (!res.ok) {
    const detail = (data && typeof data === 'object' ? data : { detail: text || res.statusText }) as ApiErrorDetail
    const error = new Error(String(detail.detail || res.statusText)) as Error & { status?: number; detail?: ApiErrorDetail }
    error.status = res.status
    error.detail = detail
    throw error
  }

  const cloudFunctionResult =
    data && typeof data === 'object' && 'result' in data ? (data as { result: unknown }).result : data
  const functionResponse =
    typeof cloudFunctionResult === 'string' ? parseJsonMaybe(cloudFunctionResult) : cloudFunctionResult

  if (!isFunctionHttpResponse(functionResponse)) return functionResponse as T
  if (functionResponse.statusCode === 204) return undefined as T

  const body = parseJsonMaybe(functionResponse.body ?? '')
  if (functionResponse.statusCode < 200 || functionResponse.statusCode >= 300) {
    const detail = (body && typeof body === 'object' ? body : { detail: functionResponse.body || 'Request failed' }) as ApiErrorDetail
    const error = new Error(String(detail.detail || 'Request failed')) as Error & { status?: number; detail?: ApiErrorDetail }
    error.status = functionResponse.statusCode
    error.detail = detail
    throw error
  }
  return body as T
}

export function queryString(params: Record<string, unknown>) {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    q.set(key, String(value))
  }
  const text = q.toString()
  return text ? `?${text}` : ''
}
