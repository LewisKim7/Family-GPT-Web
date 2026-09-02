const CHAT_WINDOW_MS = 60_000;
const attempts = new Map();

function clientKey(req) {
  return String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown")
    .split(",")[0]
    .trim();
}

export function enforcePublicRateLimit(req, res) {
  const limit = Math.max(1, Number(process.env.PUBLIC_CHAT_REQUESTS_PER_MINUTE || 6));
  const key = clientKey(req);
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now - current.startedAt >= CHAT_WINDOW_MS) {
    attempts.set(key, { count: 1, startedAt: now });
    return true;
  }
  if (current.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((CHAT_WINDOW_MS - (now - current.startedAt)) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({ error: `요청이 너무 많습니다. ${retryAfter}초 후 다시 시도하세요.` });
    return false;
  }
  current.count += 1;
  return true;
}

export function bridgeHeaders() {
  const token = process.env.BRIDGE_SHARED_SECRET;
  if (!token || token.length < 24) throw new Error("BRIDGE_SHARED_SECRET must be at least 24 characters.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export function bridgeUrl(path = "") {
  const base = String(process.env.BRIDGE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("BRIDGE_URL is not configured.");
  return `${base}${path}`;
}

export function configuredModel() {
  return String(process.env.CHATGPT_MODEL || "gpt-5.6-sol").trim();
}
