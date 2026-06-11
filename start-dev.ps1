param(
  [int]$BackendPort = 8013,
  [int]$FrontendPort = 5173,
  [switch]$AutoYes
)

$ErrorActionPreference = "Stop"

function Get-ListeningPidsForPort([int]$Port) {
  $lines = netstat -ano | Select-String -Pattern (":$Port\s+.*LISTENING")
  $pids = @()
  foreach ($m in $lines) {
    $parts = ($m.Line -split "\s+") | Where-Object { $_ -ne "" }
    if ($parts.Length -gt 0) {
      $pidStr = $parts[-1]
      if ($pidStr -match "^\d+$") { $pids += [int]$pidStr }
    }
  }
  return ($pids | Select-Object -Unique)
}

function Ensure-PortFree([int]$Port, [string]$Name) {
  $pids = Get-ListeningPidsForPort $Port
  if ($pids.Count -eq 0) { return }

  Write-Host ""
  Write-Host "$Name port $Port is in use. PID(s): $($pids -join ', ')"
  $ans = if ($AutoYes) { "Y" } else { Read-Host "Kill and continue? (Y/N)" }
  if ($ans -notin @("Y", "y")) {
    throw "Cancelled. Please free port $Port ($Name) and retry."
  }
  foreach ($p in $pids) {
    Stop-Process -Id $p -Force -ErrorAction Stop
    Write-Host "Killed PID $p"
  }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot ".")).Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$uvicornExe = Join-Path $backendDir ".venv\Scripts\uvicorn.exe"

if (-not (Test-Path $uvicornExe)) {
  throw "Backend venv not found: $uvicornExe`nCreate backend/.venv and install requirements first."
}
if (-not (Test-Path $frontendDir)) {
  throw "Frontend dir not found: $frontendDir"
}

Ensure-PortFree -Port $BackendPort -Name "后端"
Ensure-PortFree -Port $FrontendPort -Name "前端"

Write-Host ""
Write-Host "Starting backend (port $BackendPort)..."
Start-Process -WorkingDirectory $backendDir -FilePath $uvicornExe -ArgumentList @(
  "app.main:app",
  "--reload",
  "--host", "0.0.0.0",
  "--port", "$BackendPort"
)

Write-Host "Starting frontend (port $FrontendPort)..."
# Use cmd.exe so npx resolves correctly from PATH on Windows.
$frontendCmd = "npx vite --host 0.0.0.0 --port $FrontendPort"
Start-Process -WorkingDirectory $frontendDir -FilePath "cmd.exe" -ArgumentList @("/c", $frontendCmd)

Write-Host ""
Write-Host "Started:"
Write-Host "- Frontend: http://localhost:$FrontendPort/"
Write-Host "- Backend:  http://127.0.0.1:$BackendPort/docs"

