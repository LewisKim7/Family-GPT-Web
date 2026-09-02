import crypto from "node:crypto";

const COOKIE = "family_session";
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 24) throw new Error("SESSION_SECRET must be at least 24 characters.");
  return value;
}
function sign(value) { return crypto.createHmac("sha256", secret()).update(value).digest("base64url"); }
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
export function members() {
  try {
    const parsed = JSON.parse(process.env.FAMILY_MEMBERS_JSON || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}
export function verifyPin(member, pin) {
  const configured = members()[member];
  return typeof configured === "string" && configured.length > 0 && safeEqual(configured.trim(), String(pin || "").trim());
}
export function issueSession(member) {
  const payload = JSON.stringify({ member, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}
export function setSessionCookie(res, token) { res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`); }
export function clearSessionCookie(res) { res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`); }
function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((item) => item.trim()).filter(Boolean).map((item) => {
    const index = item.indexOf("=");
    return index === -1 ? [item, ""] : [item.slice(0, index), item.slice(index + 1)];
  }));
}
export function sessionMember(req) {
  try {
    const token = parseCookies(req)[COOKIE];
    if (!token) return null;
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature || !safeEqual(sign(encoded), signature)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.member || Number(payload.exp) <= Date.now() || !(payload.member in members())) return null;
    return payload.member;
  } catch { return null; }
}
export function requireMember(req, res) {
  const member = sessionMember(req);
  if (!member) { res.status(401).json({ error: "PIN 로그인이 필요합니다." }); return null; }
  return member;
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
