import crypto from "node:crypto";
import { configuredModel, enqueueJob, workerOnline } from "../lib/runtime.js";

const WINDOW_MS = 60_000;
const attempts = new Map();
function clientKey(req) { return String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown").split(",")[0].trim(); }
function allow(req) {
  const now = Date.now(); const key = clientKey(req); const current = attempts.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) { attempts.set(key, { count: 1, startedAt: now }); return true; }
  if (current.count >= 6) return false;
  current.count += 1; return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!allow(req)) return res.status(429).json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." });
  const prompt = String(req.body?.prompt || "").trim();
  const threadId = String(req.body?.threadId || crypto.randomUUID());
  if (!prompt || prompt.length > 24_000) return res.status(400).json({ error: "메시지는 1 - 24,000자여야 합니다." });
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(threadId)) return res.status(400).json({ error: "Invalid thread id" });

  const worker = await workerOnline();
  if (!worker.online) {
    const reason = worker.status?.modelAvailable === false ? "GPT-5.6 Sol을 현재 ChatGPT 계정에서 사용할 수 없습니다." : "유찬 PC의 ChatGPT worker가 오프라인입니다.";
    return res.status(503).json({ error: reason });
  }

  const id = crypto.randomUUID();
  const job = { id, threadId, prompt, model: configuredModel(), status: "queued", createdAt: Date.now(), updatedAt: Date.now() };
  await enqueueJob(job);
  return res.status(202).json({ jobId: id, status: "queued" });
}
