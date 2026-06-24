$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $venvPython)) {
    throw "Project virtual environment Python was not found at $venvPython"
}

Write-Host "Starting MarketMind AI backend with:"
Write-Host $venvPython

Set-Location $PSScriptRoot
& $venvPython -m uvicorn main:app --reload
