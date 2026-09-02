import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("data");
const file = path.join(dir, "state.json");
fs.mkdirSync(dir, { recursive: true });
let state = { jobs: {}, threads: {} };
try { state = { ...state, ...JSON.parse(fs.readFileSync(file, "utf8")) }; } catch {}

function save() {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2));
  fs.renameSync(temp, file);
}
export function putJob(job) { state.jobs[job.id] = job; save(); return job; }
export function getJob(id) { return state.jobs[id] || null; }
export function patchJob(id, patch) { if (!state.jobs[id]) return null; state.jobs[id] = { ...state.jobs[id], ...patch, updatedAt: Date.now() }; save(); return state.jobs[id]; }
export function getThread(threadId) { return state.threads[threadId] || null; }
export function setThread(threadId, value) { state.threads[threadId] = value; save(); }
export function pruneJobs(hours = 24) { const cutoff = Date.now() - hours * 3_600_000; for (const [id, job] of Object.entries(state.jobs)) if ((job.updatedAt || job.createdAt || 0) < cutoff) delete state.jobs[id]; save(); }
