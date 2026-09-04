import crypto from "node:crypto";
import { getCache } from "@vercel/functions";

const cache = getCache({ namespace: "family-gpt-web-v3" });
const WORKER_TOKEN_HASH = "32c454da3f3fff65b577751c838030ff23d934697b5ec6ca08ae8baffd08a53b";
const JOB_TTL_SECONDS = 60 * 60;
const WORKER_TTL_SECONDS = 60;
const QUEUE_KEY = "queue";

export function configuredModel() {
  return "gpt-5.6-sol";
}

export function workerAuthorized(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const digest = crypto.createHash("sha256").update(token).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(WORKER_TOKEN_HASH);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function getWorkerStatus() {
  return (await cache.get("worker:status")) || null;
}

export async function setWorkerStatus(status) {
  await cache.set("worker:status", { ...status, lastSeen: Date.now() }, { ttl: WORKER_TTL_SECONDS });
}

export async function workerOnline() {
  const status = await getWorkerStatus();
  if (!status) return { online: false, status: null };
  const fresh = Date.now() - Number(status.lastSeen || 0) < 20_000;
  return { online: fresh && status.ready === true, status };
}

export async function enqueueJob(job) {
  await cache.set(`job:${job.id}`, job, { ttl: JOB_TTL_SECONDS });
  const current = await cache.get(QUEUE_KEY);
  const queue = Array.isArray(current) ? current.filter((id) => typeof id === "string") : [];
  const next = [...queue.filter((id) => id !== job.id), job.id].slice(-20);
  await cache.set(QUEUE_KEY, next, { ttl: JOB_TTL_SECONDS });
}

export async function getJob(id) {
  return (await cache.get(`job:${id}`)) || null;
}

export async function setJob(id, value) {
  await cache.set(`job:${id}`, value, { ttl: JOB_TTL_SECONDS });
}

async function setQueue(queue) {
  await cache.set(QUEUE_KEY, queue.slice(-20), { ttl: JOB_TTL_SECONDS });
}

export async function leaseNextJob() {
  const current = await cache.get(QUEUE_KEY);
  const queue = Array.isArray(current) ? [...current] : [];
  let changed = false;
  const keep = [];
  let leased = null;

  for (const id of queue) {
    const job = await getJob(id);
    if (!job) { changed = true; continue; }
    if (["completed", "failed", "uncertain"].includes(job.status)) { changed = true; continue; }
    if (!leased && job.status === "queued") {
      leased = { ...job, status: "generating", startedAt: Date.now(), updatedAt: Date.now() };
      await setJob(id, leased);
      keep.push(id);
      continue;
    }
    keep.push(id);
  }
  if (changed || keep.length !== queue.length) await setQueue(keep);
  return leased;
}

export async function finishJob(id, patch) {
  const current = await getJob(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: Date.now() };
  await setJob(id, next);
  const queue = await cache.get(QUEUE_KEY);
  if (Array.isArray(queue) && queue.includes(id)) await setQueue(queue.filter((value) => value !== id));
  return next;
}
