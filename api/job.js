import { bridgeHeaders, bridgeUrl } from "./_bridge.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const id = String(req.query?.id || "");
  if (!/^[a-f0-9-]{36}$/i.test(id)) return res.status(400).json({ error: "Invalid job id" });
  try {
    const response = await fetch(bridgeUrl(`/jobs/${id}`), { headers: bridgeHeaders(), signal: AbortSignal.timeout(7_000) });
    const body = await response.json().catch(() => ({}));
    return res.status(response.status).json(body);
  } catch (error) {
    return res.status(503).json({ error: "ChatGPT 브리지가 오프라인입니다.", detail: error instanceof Error ? error.message : "unknown" });
  }
}
