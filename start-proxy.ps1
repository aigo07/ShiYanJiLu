param(
  [int]$Port = 8080,
  [string]$User = "test"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot ".")).Path
$proxyDir = Join-Path $root "ops\proxy"

if (-not (Test-Path $proxyDir)) {
  throw "Proxy dir not found: $proxyDir"
}

if (-not $env:PROXY_PASS) {
  Write-Host ""
  Write-Host "Set PROXY_PASS (basic auth password, >=12 chars)."
  $env:PROXY_PASS = Read-Host "PROXY_PASS"
}

$env:PROXY_PORT = "$Port"
$env:PROXY_USER = "$User"

if ([string]::IsNullOrWhiteSpace($env:FRONTEND_TARGET)) {
  $env:FRONTEND_TARGET = "http://127.0.0.1:5173"
}
if ([string]::IsNullOrWhiteSpace($env:BACKEND_TARGET)) {
  $env:BACKEND_TARGET = "http://127.0.0.1:8013"
}

Write-Host ""
Write-Host "Starting local proxy on http://127.0.0.1:$Port ..."
Write-Host "- Frontend: $env:FRONTEND_TARGET"
Write-Host "- Backend:  $env:BACKEND_TARGET (mounted at /api)"
Write-Host "- BasicAuth: $User / (hidden)"

Start-Process -WorkingDirectory $proxyDir -FilePath "cmd.exe" -ArgumentList @("/c", "npm install && npm run dev")

