param(
  [Parameter(Mandatory=$true)][string]$WorkerToken,
  [string]$SiteUrl = "https://family-gpt-web.vercel.app"
)
$ErrorActionPreference = "Stop"
$InstallDir = Join-Path $Env:LOCALAPPDATA "Family-GPT-Web"
$Venv = Join-Path $InstallDir ".venv"
$Python = Join-Path $Venv "Scripts\python.exe"
$Web2Api = Join-Path $Venv "Scripts\chatgpt-web2api.exe"
$Worker = Join-Path $InstallDir "worker.py"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$Uv = (Get-Command uv -ErrorAction SilentlyContinue).Source
if (-not $Uv) {
  $UvCandidate = Join-Path $Env:USERPROFILE ".local\bin\uv.exe"
  if (-not (Test-Path $UvCandidate)) {
    Write-Host "Installing uv..."
    Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
  }
  if (Test-Path $UvCandidate) { $Uv = $UvCandidate } else { $Uv = (Get-Command uv -ErrorAction Stop).Source }
}

if (-not (Test-Path $Python)) {
  Write-Host "Preparing Python 3.11..."
  & $Uv venv --python 3.11 $Venv
}
if (-not (Test-Path $Web2Api)) {
  Write-Host "Installing ChatGPT-Web2API..."
  & $Uv pip install --python $Python "https://github.com/Octo-Lex/ChatGPT-Web2API/archive/497527dceabfa3f95961e23c291e618c5570f1ac.zip"
}

Write-Host "Updating Family GPT worker..."
Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/LewisKim7/Family-GPT-Web/main/bridge/worker.py" -OutFile $Worker

$webCommand = "& '" + $Web2Api + "' start --host 127.0.0.1 --port 8080"
Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $webCommand
Start-Sleep -Seconds 4
Start-Process $SiteUrl
$Env:FAMILY_GPT_WORKER_TOKEN = $WorkerToken
Write-Host ""
Write-Host "A dedicated ChatGPT Chrome window will open. Log into your ChatGPT Plus account there if asked."
Write-Host "Keep this window open while Family GPT should answer questions."
& $Python $Worker --site $SiteUrl
