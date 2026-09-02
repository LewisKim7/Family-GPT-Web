$chromeCandidates = @(
  "$Env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${Env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$Env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw "Google Chrome not found." }
$profile = Join-Path $PSScriptRoot "..\.family-profile"
New-Item -ItemType Directory -Force -Path $profile | Out-Null
Start-Process $chrome -ArgumentList "--remote-debugging-port=9222", "--user-data-dir=$profile", "https://chatgpt.com/"
Write-Host "Family GPT Chrome started. Log into ChatGPT once in this dedicated window."
