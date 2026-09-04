# Owner PC setup

The public site is already deployed at `https://family-gpt-web.vercel.app`.

The owner PC only needs the private starter file issued separately. The starter:

1. installs `uv` if needed;
2. creates an isolated Python 3.11 environment under `%LOCALAPPDATA%\Family-GPT-Web`;
3. installs the pinned ChatGPT-Web2API build;
4. launches the dedicated Chrome profile used by ChatGPT-Web2API;
5. downloads the latest `bridge/worker.py` from this repository;
6. starts the outbound worker against the production Vercel site.

On the first run, complete the normal ChatGPT sign-in in the Chrome window. No ChatGPT password, cookies, OAuth token, or browser profile is stored in GitHub or Vercel.

The worker makes outbound HTTPS requests only. No router configuration, public home IP, Cloudflare Tunnel, ngrok, Supabase, or Neon is required.

Keep the worker window open while Family GPT should answer questions. Closing it makes `/api/health` report the worker as offline within roughly 20 seconds.
