import { runCodexChat } from "../lib/codex.js";

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
  try {
    const result = await runCodexChat({ messages: req.body?.messages, model: req.body?.model || "auto" });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Codex request failed";
    return res.status(message.includes("연결되어 있지") ? 503 : 500).json({ error: message });
  }
}
