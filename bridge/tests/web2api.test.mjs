import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

const port = 18080 + Math.floor(Math.random() * 1000);
process.env.WEB2API_BASE_URL = `http://127.0.0.1:${port}`;
process.env.CHATGPT_MODEL = "gpt-5.6-sol";
process.env.CHATGPT_PROJECT_ID = "project-public";
let lastPayload = null;
const server = http.createServer(async (req, res) => {
  if (req.url === "/health") { res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ status: "healthy", chrome_running: true, cdp_connected: true })); }
  if (req.url === "/v1/models") { res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ object: "list", data: [{ id: "gpt-5-6-sol" }, { id: "auto" }] })); }
  if (req.url === "/v1/chat/completions" && req.method === "POST") {
    const chunks = []; for await (const chunk of req) chunks.push(chunk); lastPayload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ conversation_id: "11111111-1111-1111-1111-111111111111", choices: [{ message: { role: "assistant", content: "OK" } }] }));
  }
  res.statusCode = 404; res.end();
});
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
const { engineHealth, resolveModel, runChatJob } = await import("../src/web2api.js");

test("resolves punctuation variants of GPT-5.6 Sol", async () => { assert.equal(await resolveModel("gpt-5.6-sol"), "gpt-5-6-sol"); });
test("health verifies browser and requested model", async () => { const health = await engineHealth(); assert.equal(health.cdpConnected, true); assert.equal(health.modelAvailable, true); assert.equal(health.resolvedModel, "gpt-5-6-sol"); });
test("sends ordinary chat request through Web2API and captures conversation", async () => { const result = await runChatJob({ threadId: "thread_12345678", prompt: "Say OK", model: "gpt-5.6-sol" }); assert.equal(result.output, "OK"); assert.equal(result.model, "gpt-5-6-sol"); assert.equal(lastPayload.project_id, "project-public"); assert.equal(lastPayload.stream, false); assert.equal(lastPayload.messages[0].content, "Say OK"); });
test.after(() => server.close());
