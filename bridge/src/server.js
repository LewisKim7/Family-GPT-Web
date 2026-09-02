import crypto from "node:crypto";
import http from "node:http";
import { engineHealth, runChatJob } from "./web2api.js";
import { getJob, patchJob, pruneJobs, putJob } from "./store.js";

const port = Number(process.env.PORT || 18_791);
const secret = process.env.BRIDGE_SHARED_SECRET || "";
const maxQueueSize = Math.max(1, Number(process.env.MAX_QUEUE_SIZE || 20));
const queue = [];
let active = false;

function json(res, status, body) { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); }
function authorized(req) { const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""); if (!secret || token.length !== secret.length) return false; return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret)); }
async function body(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); const raw = Buffer.concat(chunks).toString("utf8"); if (raw.length > 30_000) throw new Error("Request too large"); return JSON.parse(raw || "{}"); }

async function drain() {
  if (active) return;
  active = true;
  while (queue.length) {
    const id = queue.shift(); const job = getJob(id); if (!job || job.status !== "queued") continue;
    patchJob(id, { status: "generating", startedAt: Date.now() });
    try { const result = await runChatJob(job); patchJob(id, { status: "completed", output: result.output, conversationId: result.conversationId, model: result.model, completedAt: Date.now() }); }
    catch (error) { patchJob(id, { status: "failed", error: error instanceof Error ? error.message : "Unknown bridge error", completedAt: Date.now() }); }
  }
  active = false;
}

const server = http.createServer(async (req, res) => {
  if (!authorized(req)) return json(res, 401, { error: "Unauthorized" });
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true, queue: queue.length, active, ...(await engineHealth()) });
    if (req.method === "POST" && url.pathname === "/jobs") {
      const input = await body(req); const required = ["operationId", "threadId", "prompt"];
      if (required.some((key) => !input[key])) return json(res, 400, { error: "Missing required fields" });
      if (!/^[a-f0-9-]{36}$/i.test(String(input.operationId))) return json(res, 400, { error: "Invalid operation id" });
      if (!/^[a-zA-Z0-9_-]{8,80}$/.test(String(input.threadId))) return json(res, 400, { error: "Invalid thread id" });
      if (String(input.prompt).length > 24_000) return json(res, 400, { error: "Prompt too large" });
      const duplicate = getJob(input.operationId); if (duplicate) return json(res, 200, { jobId: duplicate.id, status: duplicate.status });
      if (queue.length >= maxQueueSize) return json(res, 429, { error: "Chat queue is full. Try again later." });
      const id = String(input.operationId);
      putJob({ id, operationId: id, threadId: String(input.threadId), prompt: String(input.prompt), model: String(input.model || process.env.CHATGPT_MODEL || "gpt-5.6-sol"), status: "queued", createdAt: Date.now(), updatedAt: Date.now() });
      queue.push(id); void drain(); return json(res, 202, { jobId: id, status: "queued" });
    }
    const match = url.pathname.match(/^\/jobs\/([a-f0-9-]{36})$/i);
    if (req.method === "GET" && match) { const job = getJob(match[1]); if (!job) return json(res, 404, { error: "Job not found" }); const { prompt, ...safe } = job; return json(res, 200, safe); }
    return json(res, 404, { error: "Not found" });
  } catch (error) { return json(res, 500, { error: error instanceof Error ? error.message : "Unknown error" }); }
});

pruneJobs(Number(process.env.JOB_RETENTION_HOURS || 24));
server.listen(port, "127.0.0.1", () => console.log(`Family GPT relay listening on http://127.0.0.1:${port}`));
