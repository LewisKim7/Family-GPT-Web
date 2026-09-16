# Owner machine setup

The public site is already deployed at `https://family-gpt-web.vercel.app`.

The owner machine only needs the private starter file issued separately. Both Mac and Windows starters:

1. install `uv` if needed;
2. create an isolated Python 3.11 environment;
3. install the pinned ChatGPT-Web2API build;
4. launch the dedicated Chrome profile used by ChatGPT-Web2API;
5. download the latest `bridge/worker.py` from this repository;
6. start the outbound worker against the production Vercel site.

## Mac mini / macOS

The generic launcher is `bridge/scripts/start-worker.command`. Its local application data lives under:

```text
~/Library/Application Support/Family-GPT-Web
```

If macOS blocks a downloaded private `.command` launcher on first run, right-click it and choose **Open**. If the executable bit was stripped during download, run `chmod +x START-FAMILY-GPT.command` once from Terminal.

### Optional Codex mode

GPT Web is the default mode. Codex is only a secondary/fallback mode in the same site.

After the normal Mac worker has been installed, the owner can connect the shared Codex session with:

```bash
chmod +x bridge/scripts/connect-codex.command
FAMILY_GPT_WORKER_TOKEN="<private-worker-token>" bridge/scripts/connect-codex.command
```

The script opens the official Codex device-login page, prints the one-time code, and polls the same `family-gpt-web.vercel.app` project until the session is connected. The browser UI itself cannot create or replace the shared Codex session because the auth mutation requires the private worker bearer token.

After connection, choose **Codex** from the Family GPT sidebar. No second Vercel project or domain is needed.

## Windows

The generic launcher is `bridge/scripts/start-worker.ps1`. Its local application data lives under `%LOCALAPPDATA%\\Family-GPT-Web`.

On the first run, complete the normal ChatGPT sign-in in the Chrome window. No ChatGPT password, cookies, OAuth token, or browser profile is stored in GitHub or Vercel.

The worker makes outbound HTTPS requests only. No router configuration, public home IP, Cloudflare Tunnel, ngrok, Supabase, or Neon is required.

Keep the worker Terminal/PowerShell window open while Family GPT should answer questions. Closing it makes `/api/health` report the worker as offline within roughly 20 seconds.
