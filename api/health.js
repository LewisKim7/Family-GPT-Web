import { configuredModel, workerOnline } from "../lib/runtime.js";
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { online, status } = await workerOnline();
  return res.status(200).json({
    bridge: online ? "online" : "offline",
    requestedModel: configuredModel(),
    engineStatus: status?.engineStatus || "offline",
    modelAvailable: Boolean(status?.modelAvailable),
    resolvedModel: status?.resolvedModel || null,
    lastSeen: status?.lastSeen || null,
  });
}
