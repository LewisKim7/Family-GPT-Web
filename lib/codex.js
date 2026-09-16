import crypto from "node:crypto";
import { createOpenAIOAuth } from "@openai-oauth/ai-sdk";
import {
  DEFAULT_OPENAI_OAUTH_CLIENT_ID,
  deriveAccountId,
  exchangeOpenAIOAuthCode,
  refreshOpenAIOAuthTokens,
} from "@openai-oauth/core";
import { getCache } from "@vercel/functions";
import { generateText } from "ai";

const AUTH_BASE_URL = "https://auth.openai.com";
const SESSION_KEY = "session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEVICE_TTL_SECONDS = 15 * 60;
const cache = getCache({ namespace: "family-gpt-codex-v1" });

const MODEL_CONFIGS = {
  luna: { id: "gpt-5.6-luna", reasoning: "medium" },
  terra: { id: "gpt-5.6-terra", reasoning: "medium" },
  sol: { id: "gpt-5.6-sol", reasoning: "medium" },
};

const LIGHT_TASK = /(번역|translate|맞춤법|오타|교정|한\s*줄|짧게|간단히|요약|제목.{0,8}추천|뜻.{0,8}(뭐|알려)|계산해)/i;
const DEEP_TASK = /(깊게|심층|철저|최대한.{0,12}(고민|분석|검토)|복잡|고난도|전략적|단계별|시나리오|모델링|디버그|디버깅|코드\s*리뷰|아키텍처|root\s*cause|trade-?off|증명|최적화)/i;

function normalizeMessages(input) {
  if (!Array.isArray(input)) return [];
  const selected = [];
  let total = 0;
  for (const item of input.slice(-60).reverse()) {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") continue;
    const content = item.content.slice(0, 24000);
    if (selected.length && total + content.length > 240000) break;
    selected.push({ role: item.role, content });
    total += content.length;
  }
  return selected.reverse();
}

function latestUserText(messages) {
  return [...messages].reverse().find((item) => item.role === "user")?.content?.trim() || "";
}

function routeModel(requestedModel, messages) {
  const requested = String(requestedModel || "auto").toLowerCase();
  if (MODEL_CONFIGS[requested]) return { key: requested, reason: `manual-${requested}` };
  const latest = latestUserText(messages);
  if (DEEP_TASK.test(latest) || latest.length >= 1200) return { key: "sol", reason: "deep-task" };
  if (latest.length <= 600 && LIGHT_TASK.test(latest)) return { key: "luna", reason: "light-task" };
  return { key: "terra", reason: "balanced-default" };
}

async function readSession() {
  const value = await cache.get(SESSION_KEY);
  return value && typeof value === "object" ? value : null;
}

async function writeSession(session) {
  const value = { ...session, updatedAt: Date.now() };
  await cache.set(SESSION_KEY, value, { ttl: SESSION_TTL_SECONDS, name: "Family GPT Codex session" });
  return value;
}

async function refreshSession(session) {
  const tokens = await refreshOpenAIOAuthTokens({
    refreshToken: session.refreshToken,
    clientId: DEFAULT_OPENAI_OAUTH_CLIENT_ID,
  });
  const accountId = tokens.accountId || deriveAccountId(tokens.idToken) || deriveAccountId(tokens.accessToken) || session.accountId;
  if (!accountId) throw new Error("Missing ChatGPT account id.");
  return writeSession({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || session.refreshToken,
    accountId,
    expiresAt: Date.now() + Math.max(60, Number(tokens.expiresIn || 3600)) * 1000,
  });
}

export async function getCodexSession() {
  const session = await readSession();
  if (!session?.refreshToken || !session?.accountId) return null;
  if (!session.accessToken || Number(session.expiresAt || 0) <= Date.now() + 60000) {
    try { return await refreshSession(session); } catch { return null; }
  }
  return session;
}

export async function getCodexStatus() {
  const session = await getCodexSession();
  return { connected: Boolean(session), accountId: session?.accountId || null };
}

export async function startCodexDeviceLogin() {
  if (await getCodexSession()) return { status: "connected" };
  const response = await fetch(`${AUTH_BASE_URL}/api/accounts/deviceauth/usercode`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: DEFAULT_OPENAI_OAUTH_CLIENT_ID }),
  });
  if (!response.ok) throw new Error(`Device login request failed (${response.status}).`);
  const payload = await response.json();
  const deviceAuthId = payload?.device_auth_id;
  const userCode = payload?.user_code ?? payload?.usercode;
  const interval = Number.parseInt(String(payload?.interval ?? "5"), 10) || 5;
  if (!deviceAuthId || !userCode) throw new Error("OpenAI did not return a device code.");
  const pairingId = crypto.randomUUID();
  await cache.set(`device:${pairingId}`, { deviceAuthId, userCode }, { ttl: DEVICE_TTL_SECONDS, name: "Family GPT Codex device login" });
  return { status: "pending", pairingId, userCode, interval, expiresIn: DEVICE_TTL_SECONDS, verificationUrl: `${AUTH_BASE_URL}/codex/device` };
}

export async function pollCodexDeviceLogin(pairingId) {
  if (!/^[a-f0-9-]{36}$/i.test(String(pairingId || ""))) throw new Error("Invalid pairing id.");
  const pending = await cache.get(`device:${pairingId}`);
  if (!pending?.deviceAuthId || !pending?.userCode) return { status: "expired" };
  const response = await fetch(`${AUTH_BASE_URL}/api/accounts/deviceauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_auth_id: pending.deviceAuthId, user_code: pending.userCode }),
  });
  if (response.status === 403 || response.status === 404) return { status: "pending" };
  if (!response.ok) throw new Error(`Device authorization failed (${response.status}).`);
  const payload = await response.json();
  if (!payload?.authorization_code || !payload?.code_verifier) throw new Error("OpenAI returned an incomplete authorization response.");
  const tokens = await exchangeOpenAIOAuthCode({
    code: payload.authorization_code,
    codeVerifier: payload.code_verifier,
    redirectUri: `${AUTH_BASE_URL}/deviceauth/callback`,
    clientId: DEFAULT_OPENAI_OAUTH_CLIENT_ID,
  });
  const accountId = tokens.accountId || deriveAccountId(tokens.idToken) || deriveAccountId(tokens.accessToken);
  if (!accountId || !tokens.refreshToken) throw new Error("Could not establish a persistent ChatGPT session.");
  const session = await refreshSession({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accountId,
    expiresAt: Date.now() + Math.max(60, Number(tokens.expiresIn || 3600)) * 1000,
  });
  await cache.delete(`device:${pairingId}`);
  return { status: "connected", accountId: session.accountId };
}

export async function runCodexChat({ messages: rawMessages, model: requestedModel }) {
  const session = await getCodexSession();
  if (!session) throw new Error("Codex 세션이 연결되어 있지 않습니다.");
  const messages = normalizeMessages(rawMessages);
  if (!messages.length || messages.at(-1)?.role !== "user") throw new Error("A user message is required.");
  const routed = routeModel(requestedModel, messages);
  const config = MODEL_CONFIGS[routed.key];
  const oauthProvider = createOpenAIOAuth({ kind: "openai-oauth", getSession: async () => session });
  const result = await generateText({
    model: oauthProvider(config.id),
    reasoning: config.reasoning,
    system: [
      "You are Family GPT in optional Codex mode.",
      "Reply in the user's language and answer directly.",
      "Do not describe internal OAuth or routing details unless asked.",
      "If current information is required and no search tool is available, say that you cannot verify it live.",
    ].join("\n"),
    messages,
  });
  const output = String(result.text || "").trim();
  if (!output) throw new Error("Codex returned an empty response.");
  return { output, model: config.id, mode: routed.key, reason: routed.reason };
}
