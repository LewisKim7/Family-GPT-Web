from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

STATE_FILE = Path(__file__).with_name("worker-state.json")
WEB2API = "http://127.0.0.1:8080"
TARGET_MODEL = "gpt-5.6-sol"


def load_state():
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"threads": {}}


def save_state(state):
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STATE_FILE)


def request_json(url, method="GET", body=None, token=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read().decode("utf-8")
            return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            payload = {"error": raw}
        return exc.code, payload


def normalize(value):
    return "".join(ch for ch in str(value).lower() if ch.isalnum())


def resolve_model():
    status, body = request_json(f"{WEB2API}/v1/models", timeout=8)
    if status != 200:
        raise RuntimeError(f"model probe HTTP {status}")
    ids = [str(item.get("id", "")) for item in (body or {}).get("data", []) if item.get("id")]
    target = normalize(TARGET_MODEL)
    for model_id in ids:
        if normalize(model_id) == target:
            return model_id
    for model_id in ids:
        n = normalize(model_id)
        if "gpt56" in n and "sol" in n:
            return model_id
    raise RuntimeError(f"GPT-5.6 Sol unavailable. Visible: {', '.join(ids[:12]) or 'none'}")


def local_health():
    try:
        status, body = request_json(f"{WEB2API}/health", timeout=5)
        model = resolve_model()
        ready = status == 200 and str((body or {}).get("status", "")).lower() not in {"broken", "degraded"}
        return {"ready": ready, "engineStatus": (body or {}).get("status", "online"), "modelAvailable": True, "resolvedModel": model}
    except Exception as exc:
        return {"ready": False, "engineStatus": "offline", "modelAvailable": False, "error": str(exc)}


def run_job(job, state):
    model = resolve_model()
    thread_id = str(job["threadId"])
    thread = state.setdefault("threads", {}).get(thread_id, {})
    payload = {"model": model, "messages": [{"role": "user", "content": str(job["prompt"])}], "stream": False}
    if thread.get("conversationId"):
        payload["conversation_id"] = thread["conversationId"]
    status, body = request_json(f"{WEB2API}/v1/chat/completions", method="POST", body=payload, timeout=900)
    if status != 200:
        error = (body or {}).get("error", {})
        if isinstance(error, dict):
            error = error.get("message") or error.get("code") or str(error)
        raise RuntimeError(str(error or f"ChatGPT-Web2API HTTP {status}"))
    output = str((((body or {}).get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
    if not output:
        raise RuntimeError("ChatGPT returned an empty response")
    conversation_id = str((body or {}).get("conversation_id") or thread.get("conversationId") or "")
    if conversation_id:
        state["threads"][thread_id] = {"conversationId": conversation_id, "updatedAt": int(time.time() * 1000)}
        save_state(state)
    return output, conversation_id


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", default="https://family-gpt-web.vercel.app")
    args = parser.parse_args()
    token = os.environ.get("FAMILY_GPT_WORKER_TOKEN", "").strip()
    if not token:
        raise SystemExit("FAMILY_GPT_WORKER_TOKEN is missing")
    site = args.site.rstrip("/")
    state = load_state()
    print(f"Family GPT worker connected to {site}")

    while True:
        health = local_health()
        try:
            status, job = request_json(f"{site}/api/worker?action=pull", method="POST", body={"health": health}, token=token, timeout=15)
            if status == 401:
                raise SystemExit("Worker token rejected. Download a newly issued starter from ChatGPT.")
            if status == 204 or not job:
                time.sleep(5)
                continue
            if status != 200:
                print(f"Worker poll HTTP {status}: {job}")
                time.sleep(5)
                continue
            print(f"Processing {job['id']} with {job.get('model', TARGET_MODEL)}")
            try:
                output, conversation_id = run_job(job, state)
                result = {"id": job["id"], "ok": True, "output": output, "conversationId": conversation_id}
            except Exception as exc:
                result = {"id": job["id"], "ok": False, "error": str(exc)}
            request_json(f"{site}/api/worker?action=result", method="POST", body=result, token=token, timeout=30)
            time.sleep(0.25)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            print(f"Network error: {exc}")
            time.sleep(5)


if __name__ == "__main__":
    main()
