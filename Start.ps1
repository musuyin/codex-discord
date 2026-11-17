$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
New-Item -ItemType Directory -Path (Join-Path $taskRoot '.local') -Force | Out-Null
$taskBootstrap = Join-Path $taskRoot 'bootstrap.mjs'
$taskState = Join-Path $PSScriptRoot '.local/process.json'
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot '.env'))) { throw 'Copy .env.example to .env and configure it first.' }
if (Test-Path -LiteralPath $taskState) {
  $taskOld = Get-Content -LiteralPath $taskState -Raw | ConvertFrom-Json
  $taskProcess = Get-Process -Id $taskOld.id -ErrorAction SilentlyContinue
  if ($taskProcess -and $taskProcess.StartTime.ToUniversalTime().Ticks -eq ([datetime]$taskOld.startTime).ToUniversalTime().Ticks) {
    Write-Host 'Bridge is already running.'
    exit 0
  }
}
$taskNode = (Get-Command node.exe -ErrorAction Stop).Source
$taskProcess = Start-Process -FilePath $taskNode -ArgumentList ('"' + $taskBootstrap + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot '.local/bridge.stdout.log') -RedirectStandardError (Join-Path $PSScriptRoot '.local/bridge.stderr.log') -PassThru
$taskStateValue = @{ id = $taskProcess.Id; startTime = $taskProcess.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json
[IO.File]::WriteAllText($taskState, $taskStateValue, (New-Object Text.UTF8Encoding($false)))
Write-Host ('Bridge process started. PID: ' + $taskProcess.Id)