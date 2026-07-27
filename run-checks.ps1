$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Root

function Find-Executable {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$BundledGlob
  )

  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $matches = Get-ChildItem -Path $BundledGlob -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
  if ($matches -and $matches.Count -gt 0) { return $matches[0].FullName }

  throw "Cannot find $Name. Install it or use the bundled Codex runtime."
}

$RuntimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes'
$NodeGlob = Join-Path $RuntimeRoot '*\dependencies\node\bin\node.exe'
$PythonGlob = Join-Path $RuntimeRoot '*\dependencies\python\python.exe'

$Node = Find-Executable -Name 'node' -BundledGlob $NodeGlob

$Python = Find-Executable -Name 'python' -BundledGlob $PythonGlob

Write-Host "== JS syntax =="
& $Python 'tests\check-js-syntax.py'

Write-Host "`n== Solution core =="
& $Node 'tests\test-solution-core.js'

Write-Host "`n== API request construction =="
& $Node 'tests\test-api-request.js'

Write-Host "`n== HTTP smoke =="
$port = Get-Random -Minimum 18080 -Maximum 18180
$env:AI_SOLVE_TEST_BASE = "http://127.0.0.1:$port"
$server = Start-Process -FilePath $Python -ArgumentList @('-m', 'http.server', [string]$port) -WorkingDirectory $Root -WindowStyle Hidden -PassThru

try {
  Start-Sleep -Milliseconds 800
  & $Python 'tests\run-self-test.py'
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
  Remove-Item Env:\AI_SOLVE_TEST_BASE -ErrorAction SilentlyContinue
}

Write-Host "`nALL_CHECKS_OK"
