$ErrorActionPreference = 'Stop'
$taskStatePath = Join-Path $PSScriptRoot '.local/process.json'
if (-not (Test-Path -LiteralPath $taskStatePath)) { Write-Host 'Bridge has not been started.'; exit 0 }
$taskState = Get-Content -LiteralPath $taskStatePath -Raw | ConvertFrom-Json
$taskProcess = Get-Process -Id $taskState.id -ErrorAction SilentlyContinue
if ($taskProcess -and $taskProcess.StartTime.ToUniversalTime().Ticks -eq ([datetime]$taskState.startTime).ToUniversalTime().Ticks) {
  Stop-Process -Id $taskProcess.Id
  Write-Host 'Bridge stopped.'
} else { Write-Host 'Bridge process is no longer running.' }