import { finishJob, leaseNextJob, setWorkerStatus, workerAuthorized } from "../lib/runtime.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!workerAuthorized(req)) return res.status(401).json({ error: "Unauthorized worker" });
  const action = String(req.query?.action || req.body?.action || "pull");

  if (action === "pull") {
    const health = req.body?.health && typeof req.body.health === "object" ? req.body.health : {};
    await setWorkerStatus({
      ready: health.ready === true,
      engineStatus: String(health.engineStatus || "offline"),
      modelAvailable: health.modelAvailable === true,
      resolvedModel: health.resolvedModel ? String(health.resolvedModel) : null,
    });
    if (health.ready !== true) return res.status(204).end();
    const job = await leaseNextJob();
    if (!job) return res.status(204).end();
    return res.status(200).json({ id: job.id, threadId: job.threadId, prompt: job.prompt, model: job.model });
  }

  if (action === "result") {
    const id = String(req.body?.id || "");
    if (!/^[a-f0-9-]{36}$/i.test(id)) return res.status(400).json({ error: "Invalid job id" });
    const ok = req.body?.ok === true;
    const patch = ok
      ? { status: "completed", output: String(req.body?.output || "").slice(0, 300_000), conversationId: String(req.body?.conversationId || ""), completedAt: Date.now() }
      : { status: "failed", error: String(req.body?.error || "Unknown worker error").slice(0, 4_000), completedAt: Date.now() };
    const job = await finishJob(id, patch);
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown worker action" });
}
