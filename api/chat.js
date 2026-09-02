import crypto from "node:crypto";
import { bridgeHeaders, bridgeUrl, requireMember } from "./_auth.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const member = requireMember(req, res);
  if (!member) return;
  const prompt = String(req.body?.prompt || "").trim();
  const threadId = String(req.body?.threadId || crypto.randomUUID());
  const model = String(req.body?.model || "auto").trim();
  if (!prompt || prompt.length > 24000) return res.status(400).json({ error: "메시지는 1 - 24,000자여야 합니다." });
  try {
    const response = await fetch(bridgeUrl("/jobs"), {
      method: "POST", headers: bridgeHeaders(), body: JSON.stringify({ operationId: crypto.randomUUID(), member, threadId, prompt, model }), signal: AbortSignal.timeout(9000)
    });
    const body = await response.json().catch(() => ({}));
    return res.status(response.status).json(body);
  } catch (error) {
    return res.status(503).json({ error: "Family Bridge가 오프라인입니다.", detail: error instanceof Error ? error.message : "unknown" });
  }
}
