const $ = (id) => document.getElementById(id);
let mode = "web";
let webThreadId = localStorage.getItem("familyGptPublicThreadId") || crypto.randomUUID();
let codexConnected = false;
const histories = { web: [], codex: [] };

function escapeStateMessage() {
  return mode === "web" ? "무엇이든 물어보세요" : codexConnected ? "Codex 보조 모드" : "Codex는 관리자 연결 후 사용할 수 있습니다";
}
function renderMessages() {
  const root = $("messages"); root.replaceChildren();
  const history = histories[mode];
  if (!history.length) { const empty = document.createElement("div"); empty.id = "empty"; empty.className = "empty"; empty.textContent = escapeStateMessage(); root.appendChild(empty); return; }
  for (const item of history) { const node = document.createElement("div"); node.className = `message ${item.role}`; node.textContent = item.content; root.appendChild(node); }
  root.scrollTop = root.scrollHeight;
}
function addMessage(role, text, extra = "", persist = true) {
  $("empty")?.remove();
  const node = document.createElement("div"); node.className = `message ${role} ${extra}`.trim(); node.textContent = text; $("messages").appendChild(node); $("messages").scrollTop = $("messages").scrollHeight;
  if (persist) histories[mode].push({ role, content: text });
  return node;
}
async function jsonFetch(url, options = {}) { const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`); return body; }

async function refreshHealth() {
  const [web, codex] = await Promise.all([
    jsonFetch("/api/health").catch(() => ({ bridge: "offline" })),
    jsonFetch("/api/codex-auth").catch(() => ({ connected: false })),
  ]);
  const webGood = web.bridge === "online" && web.modelAvailable === true;
  codexConnected = codex.connected === true;
  if (mode === "web") {
    $("status").textContent = webGood ? `● ${web.resolvedModel || "GPT-5.6 Sol"} 연결됨` : "○ ChatGPT worker 오프라인";
    $("status").dataset.state = webGood ? "online" : "offline";
    $("send").disabled = false;
  } else {
    $("status").textContent = codexConnected ? "● Codex 연결됨" : "○ Codex 미연결";
    $("status").dataset.state = codexConnected ? "online" : "offline";
    $("send").disabled = !codexConnected;
  }
  $("sidebarStatus").textContent = `GPT Web ${webGood ? "온라인" : "오프라인"} · Codex ${codexConnected ? "연결됨" : "미연결"}`;
  if (!histories[mode].length) renderMessages();
}

async function poll(jobId, pending) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const job = await jsonFetch(`/api/job?id=${encodeURIComponent(jobId)}`);
    if (job.status === "queued") pending.textContent = "Mac mini worker 대기 중…";
    if (job.status === "generating") pending.textContent = "ChatGPT가 생각 중…";
    if (job.status === "completed") { pending.classList.remove("pending"); pending.textContent = job.output || "(빈 응답)"; histories.web.push({ role: "assistant", content: pending.textContent }); return; }
    if (["failed", "uncertain"].includes(job.status)) throw new Error(job.error || `Job ${job.status}`);
  }
  throw new Error("응답 대기 시간이 초과되었습니다.");
}

async function submitWeb(prompt, pending) {
  const result = await jsonFetch("/api/chat", { method: "POST", body: JSON.stringify({ prompt, threadId: webThreadId }) });
  localStorage.setItem("familyGptPublicThreadId", webThreadId);
  await poll(result.jobId, pending);
}
async function submitCodex(pending) {
  const result = await jsonFetch("/api/codex", { method: "POST", body: JSON.stringify({ model: "auto", messages: histories.codex }) });
  pending.classList.remove("pending"); pending.textContent = result.output || "(빈 응답)";
  histories.codex.push({ role: "assistant", content: pending.textContent });
  $("modelPill").textContent = `Codex · ${result.model || "Auto"}`;
}

function setMode(next) {
  if (!["web", "codex"].includes(next) || next === mode) return;
  mode = next;
  document.querySelectorAll(".mode-button").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  $("modeTitle").textContent = mode === "web" ? "GPT Web" : "Codex";
  $("modelPill").textContent = mode === "web" ? "GPT-5.6 Sol" : "Codex · Auto";
  $("prompt").placeholder = mode === "web" ? "메시지 입력" : "Codex에 메시지 입력";
  renderMessages();
  closeSidebar();
  refreshHealth().catch(() => {});
}
function openSidebar() { $("sidebar").classList.add("open"); $("backdrop").classList.add("show"); }
function closeSidebar() { $("sidebar").classList.remove("open"); $("backdrop").classList.remove("show"); }

document.querySelectorAll(".mode-button").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
$("menuToggle").addEventListener("click", openSidebar); $("backdrop").addEventListener("click", closeSidebar);
$("composer").addEventListener("submit", async (event) => {
  event.preventDefault(); const prompt = $("prompt").value.trim(); if (!prompt) return;
  if (mode === "codex" && !codexConnected) return;
  $("prompt").value = ""; addMessage("user", prompt); const pending = addMessage("assistant", "전송 중…", "pending", false); $("send").disabled = true;
  try { if (mode === "web") await submitWeb(prompt, pending); else await submitCodex(pending); }
  catch (error) { pending.classList.remove("pending"); pending.textContent = `오류: ${error.message}`; }
  finally { if (mode === "web" || codexConnected) $("send").disabled = false; $("prompt").focus(); }
});
$("newChat").addEventListener("click", () => { histories[mode] = []; if (mode === "web") { webThreadId = crypto.randomUUID(); localStorage.setItem("familyGptPublicThreadId", webThreadId); } renderMessages(); });
$("prompt").addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("composer").requestSubmit(); } });
renderMessages(); refreshHealth().catch(() => {}); setInterval(() => refreshHealth().catch(() => {}), 15000);
