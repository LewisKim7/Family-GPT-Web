import { bridgeHeaders, bridgeUrl, configuredModel } from "./_bridge.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const response = await fetch(bridgeUrl("/health"), { headers: bridgeHeaders(), signal: AbortSignal.timeout(4_000) });
    const body = await response.json().catch(() => ({}));
    return res.status(200).json({ bridge: response.ok ? "online" : "degraded", requestedModel: configuredModel(), ...body });
  } catch {
    return res.status(200).json({ bridge: "offline", requestedModel: configuredModel() });
  }
}
