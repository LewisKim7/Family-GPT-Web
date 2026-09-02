# Setup

## 1. Vercel

Deploy the repository root and configure:

- `FAMILY_MEMBERS_JSON` - e.g. `{\"dad\":\"1234\",\"mom\":\"2345\",\"sister\":\"3456\"}`
- `SESSION_SECRET` - random 32+ byte secret
- `BRIDGE_URL` - HTTPS URL that reaches the local bridge through a private authenticated tunnel/reverse proxy
- `BRIDGE_SHARED_SECRET` - random 32+ byte secret; same value on bridge

The repo never stores ChatGPT credentials, cookies, or Plus OAuth tokens.

## 2. Dedicated Chrome profile on the owner PC

```powershell
cd bridge\scripts
.\start-family-chrome.ps1
```

Log into `chatgpt.com` manually once. The dedicated profile is separate from normal Chrome and exposes CDP only on localhost port `9222`.

## 3. Local bridge

```powershell
cd bridge
npm install
$Env:BRIDGE_SHARED_SECRET="..."
$Env:FAMILY_PROJECT_URLS_JSON='{"dad":"https://chatgpt.com/","mom":"https://chatgpt.com/","sister":"https://chatgpt.com/"}'
npm start
```

For stronger context isolation, create one ChatGPT Project per family member and replace the three URLs with those project URLs.

## 4. Private ingress

Do not expose port `18791` directly to the internet. Put it behind an authenticated private tunnel or reverse proxy. The bridge itself additionally requires `BRIDGE_SHARED_SECRET` and binds only to `127.0.0.1`.

## 5. Limits

- Requests are serialized intentionally. One browser tab handles one generation at a time.
- Selectors depend on the visible ChatGPT UI and may require maintenance after UI changes.
- A live Plus test cannot be performed from GitHub or Vercel alone because the signed-in browser must run on the owner's machine.
- This uses the visible ChatGPT web product, not the official OpenAI API. Review applicable OpenAI terms before relying on it.
