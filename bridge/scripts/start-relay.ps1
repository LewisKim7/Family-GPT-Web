$ErrorActionPreference = "Stop"
$BridgeDir = Split-Path -Parent $PSScriptRoot
Set-Location $BridgeDir
if (-not $Env:BRIDGE_SHARED_SECRET) { throw "Set BRIDGE_SHARED_SECRET first." }
if (-not $Env:CHATGPT_MODEL) { $Env:CHATGPT_MODEL = "gpt-5.6-sol" }
node src/server.js
