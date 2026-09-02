$ErrorActionPreference = "Stop"
$BridgeDir = Split-Path -Parent $PSScriptRoot
$Venv = Join-Path $BridgeDir ".venv-web2api"
$Python = Join-Path $Venv "Scripts\python.exe"

if (-not (Test-Path $Python)) {
  py -3.11 -m venv $Venv
}

& $Python -m pip install --upgrade pip
& $Python -m pip install "git+https://github.com/Octo-Lex/ChatGPT-Web2API.git@497527dceabfa3f95961e23c291e618c5570f1ac"
Write-Host "ChatGPT-Web2API installed in $Venv"
