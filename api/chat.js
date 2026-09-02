import crypto from "node:crypto";
import { bridgeHeaders, bridgeUrl, configuredModel, enforcePublicRateLimit } from "./_bridge.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!enforcePublicRateLimit(req, res)) return;

  const prompt = String(req.body?.prompt || "").trim();
  const threadId = String(req.body?.threadId || crypto.randomUUID());
  if (!prompt || prompt.length > 24_000) {
    return res.status(400).json({ error: "메시지는 1 - 24,000자여야 합니다." });
  }
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(threadId)) {
    return res.status(400).json({ error: "Invalid thread id" });
  }

  try {
    const response = await fetch(bridgeUrl("/jobs"), {
      method: "POST",
      headers: bridgeHeaders(),
      body: JSON.stringify({ operationId: crypto.randomUUID(), threadId, prompt, model: configuredModel() }),
      signal: AbortSignal.timeout(9_000),
    });
    const body = await response.json().catch(() => ({}));
    return res.status(response.status).json(body);
  } catch (error) {
    return res.status(503).json({ error: "ChatGPT 브리지가 오프라인입니다.", detail: error instanceof Error ? error.message : "unknown" });
  }
}
