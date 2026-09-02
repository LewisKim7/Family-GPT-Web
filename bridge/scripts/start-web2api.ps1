$ErrorActionPreference = "Stop"
$BridgeDir = Split-Path -Parent $PSScriptRoot
$Exe = Join-Path $BridgeDir ".venv-web2api\Scripts\chatgpt-web2api.exe"
if (-not (Test-Path $Exe)) { throw "ChatGPT-Web2API is not installed. Run .\setup-web2api.ps1 first." }
& $Exe start --host 127.0.0.1 --port 8080
