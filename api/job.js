import { finishJob, getJob } from "../lib/runtime.js";
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const id = String(req.query?.id || "");
  if (!/^[a-f0-9-]{36}$/i.test(id)) return res.status(400).json({ error: "Invalid job id" });
  let job = await getJob(id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status === "generating" && Date.now() - Number(job.startedAt || 0) > 15 * 60_000) {
    job = await finishJob(id, { status: "uncertain", error: "응답 연결이 중간에 끊겼습니다. 중복 전송을 막기 위해 자동 재전송하지 않았습니다." });
  }
  const { prompt, ...safe } = job;
  return res.status(200).json(safe);
}
