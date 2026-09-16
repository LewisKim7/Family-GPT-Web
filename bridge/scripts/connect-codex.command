#!/bin/bash
set -euo pipefail

SITE_URL="${FAMILY_GPT_SITE_URL:-https://family-gpt-web.vercel.app}"
WORKER_TOKEN="${FAMILY_GPT_WORKER_TOKEN:-${1:-}}"
PYTHON="$HOME/Library/Application Support/Family-GPT-Web/.venv/bin/python"

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
if [ ! -x "$PYTHON" ]; then
  echo "Family GPT Python environment was not found. Run start-worker.command first."
  exit 1
fi

STATUS="$(curl -fsS "$SITE_URL/api/codex-auth")"
CONNECTED="$(printf '%s' "$STATUS" | "$PYTHON" -c 'import json,sys; print(str(bool(json.load(sys.stdin).get("connected"))).lower())')"
if [ "$CONNECTED" = "true" ]; then
  echo "Codex is already connected."
  open "$SITE_URL" >/dev/null 2>&1 || true
  exit 0
fi

START="$(curl -fsS -X POST "$SITE_URL/api/codex-auth" \
  -H "Authorization: Bearer $WORKER_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"action":"start"}')"

PAIRING_ID="$(printf '%s' "$START" | "$PYTHON" -c 'import json,sys; print(json.load(sys.stdin).get("pairingId", ""))')"
USER_CODE="$(printf '%s' "$START" | "$PYTHON" -c 'import json,sys; print(json.load(sys.stdin).get("userCode", ""))')"
VERIFY_URL="$(printf '%s' "$START" | "$PYTHON" -c 'import json,sys; print(json.load(sys.stdin).get("verificationUrl", ""))')"
INTERVAL="$(printf '%s' "$START" | "$PYTHON" -c 'import json,sys; print(int(json.load(sys.stdin).get("interval", 5)))')"
START_STATUS="$(printf '%s' "$START" | "$PYTHON" -c 'import json,sys; print(json.load(sys.stdin).get("status", ""))')"

if [ "$START_STATUS" = "connected" ]; then
  echo "Codex is already connected."
  exit 0
fi
if [ -z "$PAIRING_ID" ] || [ -z "$USER_CODE" ] || [ -z "$VERIFY_URL" ]; then
  echo "Could not start Codex device login."
  echo "$START"
  exit 1
fi

echo ""
echo "Codex device login started."
echo "Code: $USER_CODE"
echo "Opening: $VERIFY_URL"
echo "Complete the login in the browser. This Terminal will detect completion automatically."
open "$VERIFY_URL" >/dev/null 2>&1 || true

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
for _ in $(seq 1 180); do
  sleep "$INTERVAL"
  HTTP_CODE="$(curl -sS -o "$TMP" -w '%{http_code}' -X POST "$SITE_URL/api/codex-auth" \
    -H "Authorization: Bearer $WORKER_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"action\":\"poll\",\"pairingId\":\"$PAIRING_ID\"}")"
  BODY="$(cat "$TMP")"
  if [ "$HTTP_CODE" = "202" ]; then
    continue
  fi
  if [ "$HTTP_CODE" = "200" ]; then
    RESULT="$(printf '%s' "$BODY" | "$PYTHON" -c 'import json,sys; print(json.load(sys.stdin).get("status", ""))')"
    if [ "$RESULT" = "connected" ]; then
      echo ""
      echo "Codex connected successfully."
      echo "Open Family GPT and choose Codex from the sidebar."
      open "$SITE_URL" >/dev/null 2>&1 || true
      exit 0
    fi
  fi
  echo "Codex login failed: HTTP $HTTP_CODE"
  echo "$BODY"
  exit 1
done

echo "Codex login timed out. Run this script again."
exit 1
