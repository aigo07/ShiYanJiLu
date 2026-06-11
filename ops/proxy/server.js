import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import crypto from 'crypto'

const FRONTEND_TARGET = process.env.FRONTEND_TARGET ?? 'http://127.0.0.1:5173'
const BACKEND_TARGET = process.env.BACKEND_TARGET ?? 'http://127.0.0.1:8013'
const PORT = Number(process.env.PROXY_PORT ?? '8080')

const USER = process.env.PROXY_USER ?? 'test'
const PASS = process.env.PROXY_PASS ?? ''
const ALLOW_API_DOCS = (process.env.ALLOW_API_DOCS ?? '0') === '1'

if (!PASS || PASS.trim().length < 12) {
  const suggested = crypto.randomBytes(12).toString('base64url')
  // eslint-disable-next-line no-console
  console.error(
    `Missing/weak PROXY_PASS. Set a strong password (>=12 chars).\n` +
      `Example:\n` +
      `  set PROXY_USER=${USER}\n` +
      `  set PROXY_PASS=${suggested}\n`,
  )
  process.exit(2)
}

function unauthorized(res) {
  res.setHeader('WWW-Authenticate', 'Basic realm="Shiyanjilu Test"')
  res.status(401).send('Unauthorized')
}

function basicAuth(req, res, next) {
  const h = req.headers.authorization
  if (!h || !h.startsWith('Basic ')) return unauthorized(res)
  let decoded = ''
  try {
    decoded = Buffer.from(h.slice(6), 'base64').toString('utf8')
  } catch {
    return unauthorized(res)
  }
  const idx = decoded.indexOf(':')
  if (idx < 0) return unauthorized(res)
  const u = decoded.slice(0, idx)
  const p = decoded.slice(idx + 1)
  if (u !== USER || p !== PASS) return unauthorized(res)
  return next()
}

const app = express()

// Basic hardening headers (works behind tunnel too)
app.disable('x-powered-by')
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  next()
})

// Extra gate in front of everything
app.use(basicAuth)

// Block common API introspection endpoints by default
app.use('/api', (req, res, next) => {
  const p = req.path || ''
  if (!ALLOW_API_DOCS && (p.startsWith('/docs') || p.startsWith('/openapi') || p.startsWith('/redoc'))) {
    return res.status(404).send('Not Found')
  }
  return next()
})

// Proxy /api -> backend
app.use(
  '/api',
  createProxyMiddleware({
    target: BACKEND_TARGET,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/api': '' },
    proxyTimeout: 60_000,
  }),
)

// Everything else -> frontend
app.use(
  '/',
  createProxyMiddleware({
    target: FRONTEND_TARGET,
    changeOrigin: true,
    ws: true,
    proxyTimeout: 60_000,
  }),
)

app.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`Proxy listening on http://127.0.0.1:${PORT}`)
  // eslint-disable-next-line no-console
  console.log(`Frontend -> ${FRONTEND_TARGET}`)
  // eslint-disable-next-line no-console
  console.log(`Backend  -> ${BACKEND_TARGET} (mounted at /api)`)
  // eslint-disable-next-line no-console
  console.log(`Basic auth user=${USER} pass=(hidden)`)
})

