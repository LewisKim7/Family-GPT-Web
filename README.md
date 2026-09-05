# Family GPT Web

Public Vercel chat UI backed by the owner's **ordinary signed-in ChatGPT web session** through ChatGPT-Web2API. Visitors do not need an OpenAI API key, ChatGPT login, PIN, extension, or local software.

## Architecture

```text
Visitor -> family-gpt-web.vercel.app -> Vercel Runtime Cache job queue
                                              ^              |
                                              | outbound poll |
                                              |              v
                                 owner Mac/PC worker -> ChatGPT-Web2API
                                                       -> real Chrome
                                                       -> chatgpt.com
                                                       -> GPT-5.6 Sol
```

There is no inbound home-network port, Cloudflare Tunnel, ngrok, Supabase, Neon, or OpenAI API billing.

## Owner machine

### macOS / Mac mini

Run `bridge/scripts/start-worker.command` with the private worker token, or use the private Mac launcher issued to the owner. It installs `uv` if needed, creates an isolated Python 3.11 environment under `~/Library/Application Support/Family-GPT-Web`, installs the pinned ChatGPT-Web2API build, starts the dedicated ChatGPT browser engine, downloads the latest `bridge/worker.py`, and begins outbound polling to Vercel.

### Windows

`bridge/scripts/start-worker.ps1` provides the equivalent flow under `%LOCALAPPDATA%\\Family-GPT-Web`.

On first run, sign into ChatGPT Plus in the Chrome window opened by ChatGPT-Web2API. Keep the worker Terminal/PowerShell window open while the public site should answer questions.

## Resource usage

The idle worker polls about once every five seconds (~518k function invocations/month if left on 24/7), below the Vercel Hobby 1M invocation allowance before normal site traffic. Jobs and status are small Runtime Cache entries with one-hour TTLs.

## Verification

```bash
npm run check
python -m py_compile bridge/worker.py
bash -n bridge/scripts/start-worker.command
```

> This automates the ChatGPT web product and is not the official OpenAI API. Web UI behavior and account policy can change. The public site intentionally shares the owner's ChatGPT-backed capacity with visitors; keep request limits conservative.
