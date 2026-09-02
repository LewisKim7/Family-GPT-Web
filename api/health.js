import { bridgeHeaders, bridgeUrl, sessionMember } from "./_auth.js";
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const member = sessionMember(req);
  if (!member) return res.status(200).json({ authenticated: false, bridge: "unknown" });
  try {
    const response = await fetch(bridgeUrl("/health"), { headers: bridgeHeaders(), signal: AbortSignal.timeout(4000) });
    const body = await response.json().catch(() => ({}));
    return res.status(200).json({ authenticated: true, member, bridge: response.ok ? "online" : "degraded", ...body });
  } catch { return res.status(200).json({ authenticated: true, member, bridge: "offline" }); }
}
