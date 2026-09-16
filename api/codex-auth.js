import { workerAuthorized } from "../lib/runtime.js";
import { getCodexStatus, pollCodexDeviceLogin, startCodexDeviceLogin } from "../lib/codex.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const status = await getCodexStatus();
    return res.status(200).json(status);
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!workerAuthorized(req)) return res.status(401).json({ error: "Owner authorization required" });
  try {
    const action = String(req.body?.action || "start");
    if (action === "start") return res.status(200).json(await startCodexDeviceLogin());
    if (action === "poll") {
      const result = await pollCodexDeviceLogin(String(req.body?.pairingId || ""));
      return res.status(result.status === "pending" ? 202 : result.status === "expired" ? 410 : 200).json(result);
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Codex auth failed" });
  }
}
