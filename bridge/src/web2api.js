import { getThread, setThread } from "./store.js";

const baseUrl = String(process.env.WEB2API_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const apiKey = String(process.env.WEB2API_API_KEY || "").trim();
const projectId = String(process.env.CHATGPT_PROJECT_ID || "").trim();
const defaultModel = String(process.env.CHATGPT_MODEL || "gpt-5.6-sol").trim();
let modelCache = { expiresAt: 0, ids: [] };

function headers(json = false) { const value = {}; if (json) value["Content-Type"] = "application/json"; if (apiKey) value.Authorization = `Bearer ${apiKey}`; return value; }
async function engineFetch(path, options = {}, timeoutMs = 15_000) { return fetch(`${baseUrl}${path}`, { ...options, headers: { ...headers(Boolean(options.body)), ...(options.headers || {}) }, signal: AbortSignal.timeout(timeoutMs) }); }
function normalizeModel(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

async function modelIds(force = false) {
  if (!force && modelCache.expiresAt > Date.now()) return modelCache.ids;
  const response = await engineFetch("/v1/models", {}, 12_000);
  if (!response.ok) throw new Error(`ChatGPT-Web2API model probe failed: HTTP ${response.status}`);
  const body = await response.json();
  const ids = Array.isArray(body?.data) ? body.data.map((item) => String(item?.id || "")).filter(Boolean) : [];
  modelCache = { ids, expiresAt: Date.now() + 60_000 };
  return ids;
}

export async function resolveModel(requested = defaultModel) {
  const ids = await modelIds();
  const target = normalizeModel(requested);
  const exact = ids.find((id) => normalizeModel(id) === target);
  if (exact) return exact;
  const isSol56 = target.includes("gpt56") && target.includes("sol");
  if (isSol56) {
    const candidate = ids.find((id) => { const normalized = normalizeModel(id); return normalized.includes("gpt56") && normalized.includes("sol"); });
    if (candidate) return candidate;
  }
  throw new Error(`Requested ChatGPT model '${requested}' is not exposed by the signed-in web session. Visible models: ${ids.slice(0, 12).join(", ") || "none"}`);
}

function errorMessage(body, status) { const value = body?.error?.message || body?.error || body?.message; return value ? String(value) : `ChatGPT-Web2API request failed: HTTP ${status}`; }

export async function runChatJob(job) {
  const model = await resolveModel(job.model || defaultModel);
  const thread = getThread(job.threadId);
  const payload = { model, messages: [{ role: "user", content: job.prompt }], stream: false };
  if (thread?.conversationId) payload.conversation_id = thread.conversationId;
  if (!thread?.conversationId && projectId) payload.project_id = projectId;
  const response = await engineFetch("/v1/chat/completions", { method: "POST", body: JSON.stringify(payload) }, Number(process.env.WEB2API_REQUEST_TIMEOUT_MS || 600_000));
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const retryAfter = response.headers.get("retry-after"); const suffix = retryAfter ? ` Retry after ${retryAfter}s.` : ""; throw new Error(`${errorMessage(body, response.status)}${suffix}`); }
  const output = String(body?.choices?.[0]?.message?.content || "").trim();
  if (!output) throw new Error("ChatGPT returned an empty response.");
  const conversationId = String(body?.conversation_id || thread?.conversationId || "").trim();
  if (conversationId) setThread(job.threadId, { conversationId, updatedAt: Date.now() });
  return { output, conversationId, model };
}

export async function engineHealth() {
  try {
    const response = await engineFetch("/health", {}, 4_000);
    const health = await response.json().catch(() => ({}));
    let modelAvailable = false; let resolvedModel = null;
    try { resolvedModel = await resolveModel(defaultModel); modelAvailable = true; } catch {}
    return { engine: "chatgpt-web2api", engineStatus: response.ok ? health.status || "online" : "degraded", chromeRunning: Boolean(health.chrome_running), cdpConnected: Boolean(health.cdp_connected || health.driver_connected), modelAvailable, resolvedModel };
  } catch (error) {
    return { engine: "chatgpt-web2api", engineStatus: "offline", modelAvailable: false, error: error instanceof Error ? error.message : "unknown" };
  }
}
