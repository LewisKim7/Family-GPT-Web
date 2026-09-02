# Setup

## 1. Install the proven ChatGPT web engine on the owner PC

Requirements: Windows, Google Chrome, Git, Node.js 20+, Python 3.11+.

```powershell
cd bridge\scripts
.\setup-web2api.ps1
.\start-web2api.ps1
```

`ChatGPT-Web2API` uses a dedicated persistent Chrome profile under the user's home directory. On first run Chrome opens at `chatgpt.com`; sign into the owner's ChatGPT Plus account manually. Keep this process running.

Verify locally:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health
Invoke-RestMethod http://127.0.0.1:8080/v1/models
```

The second command must show a GPT-5.6 Sol model. The Family relay will fail closed if it cannot find one.

## 2. Start the Family relay

Open a second terminal:

```powershell
cd bridge
$Env:BRIDGE_SHARED_SECRET="use-a-long-random-secret"
$Env:CHATGPT_MODEL="gpt-5.6-sol"
node src/server.js
```

Optional: set `CHATGPT_PROJECT_ID` if every public chat should start inside one dedicated ChatGPT Project. Leave it empty for ordinary new ChatGPT chats.

Verify:

```powershell
$headers = @{ Authorization = "Bearer $Env:BRIDGE_SHARED_SECRET" }
Invoke-RestMethod http://127.0.0.1:18791/health -Headers $headers
```

Healthy output should report `engine=chatgpt-web2api`, `cdpConnected=true`, and `modelAvailable=true`.

## 3. Give Vercel a stable HTTPS route to the relay

The relay binds only to `127.0.0.1`. Put it behind a private authenticated tunnel/reverse proxy and expose only relay port `18791`, never ChatGPT-Web2API port `8080` or Chrome CDP port `9222`.

Set these Vercel environment variables:

```text
BRIDGE_URL=https://your-relay-host.example.com
BRIDGE_SHARED_SECRET=<same relay secret>
CHATGPT_MODEL=gpt-5.6-sol
PUBLIC_CHAT_REQUESTS_PER_MINUTE=6
```

Visitors need none of these values; they only visit the Vercel URL.

## 4. Smoke test the exact path

1. Open the Vercel site in an incognito browser that is **not** signed into ChatGPT.
2. Confirm status says `ChatGPT Plus 연결됨`.
3. Ask `딱 OK라고만 답해`.
4. The Vercel UI should show the answer extracted from the owner's ordinary ChatGPT web session.
5. Click `새 대화` and confirm a new browser-side `threadId` creates a new ChatGPT conversation.

## Operational limits

- One owner ChatGPT session means account quota/rate limits are shared by all visitors.
- The local relay queue defaults to 20 jobs and processes one generation at a time.
- The in-code Vercel IP limiter is best-effort because serverless instances do not share memory. Configure a real Vercel/edge firewall rate limit before making the URL widely public.
- If the owner PC, ChatGPT-Web2API, relay, or tunnel is down, the site reports the backend as offline.
