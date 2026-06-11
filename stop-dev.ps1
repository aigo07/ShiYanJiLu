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

function Stop-Port([int]$Port, [string]$Name) {
  $pids = Get-ListeningPidsForPort $Port
  if ($pids.Count -eq 0) {
    Write-Host "$Name port $Port is not listening."
    return
  }
  Write-Host "$Name port $Port is listening. PID(s): $($pids -join ', ')"
  $ans = if ($AutoYes) { "Y" } else { Read-Host "Kill these processes? (Y/N)" }
  if ($ans -notin @("Y", "y")) {
    Write-Host "Skipped $Name"
    return
  }
  foreach ($p in $pids) {
    Stop-Process -Id $p -Force
    Write-Host "Killed PID $p"
  }
}

Stop-Port -Port $FrontendPort -Name "Frontend"
Stop-Port -Port $BackendPort -Name "Backend"

