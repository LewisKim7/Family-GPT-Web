#!/bin/bash
set -euo pipefail

SITE_URL="${FAMILY_GPT_SITE_URL:-https://family-gpt-web.vercel.app}"
WORKER_TOKEN="${FAMILY_GPT_WORKER_TOKEN:-${1:-}}"
INSTALL_DIR="$HOME/Library/Application Support/Family-GPT-Web"
VENV="$INSTALL_DIR/.venv"
PYTHON="$VENV/bin/python"
WEB2API="$VENV/bin/chatgpt-web2api"
WORKER="$INSTALL_DIR/worker.py"
WEB2API_LOG="$INSTALL_DIR/web2api.log"
WEB2API_PID="$INSTALL_DIR/web2api.pid"

mkdir -p "$INSTALL_DIR"

if [ -z "$WORKER_TOKEN" ]; then
  printf "Family GPT worker token: "
  stty -echo
  read -r WORKER_TOKEN
  stty echo
  printf "\n"
fi
if [ -z "$WORKER_TOKEN" ]; then
  echo "Worker token is required."
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "[Family GPT] Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

UV_BIN="$(command -v uv || true)"
if [ -z "$UV_BIN" ] && [ -x "$HOME/.local/bin/uv" ]; then
  UV_BIN="$HOME/.local/bin/uv"
fi
if [ -z "$UV_BIN" ]; then
  echo "uv installation failed."
  exit 1
fi

if [ ! -x "$PYTHON" ]; then
  echo "[Family GPT] Preparing Python 3.11..."
  "$UV_BIN" venv --python 3.11 "$VENV"
fi

if [ ! -x "$WEB2API" ]; then
  echo "[Family GPT] Installing ChatGPT-Web2API..."
  "$UV_BIN" pip install --python "$PYTHON" \
    "https://github.com/Octo-Lex/ChatGPT-Web2API/archive/497527dceabfa3f95961e23c291e618c5570f1ac.zip"
fi

echo "[Family GPT] Updating worker..."
curl -fsSL \
  "https://raw.githubusercontent.com/LewisKim7/Family-GPT-Web/main/bridge/worker.py" \
  -o "$WORKER"

if [ -f "$WEB2API_PID" ] && kill -0 "$(cat "$WEB2API_PID")" 2>/dev/null; then
  echo "[Family GPT] ChatGPT-Web2API is already running."
else
  echo "[Family GPT] Starting ChatGPT-Web2API..."
  nohup "$WEB2API" start --host 127.0.0.1 --port 8080 >>"$WEB2API_LOG" 2>&1 &
  echo $! > "$WEB2API_PID"
fi

sleep 4
open "$SITE_URL" >/dev/null 2>&1 || true

export FAMILY_GPT_WORKER_TOKEN="$WORKER_TOKEN"
echo ""
echo "Family GPT worker is running on this Mac mini."
echo "A dedicated ChatGPT Chrome window may open. Log into ChatGPT Plus there if requested."
echo "Keep this Terminal window open while Family GPT should answer questions."
echo "Site: $SITE_URL"
echo ""
exec "$PYTHON" "$WORKER" --site "$SITE_URL"
