# Family GPT Web

**Single repository / single Vercel project** for Family GPT.

Default mode is **GPT Web**: the public site sends a job to the owner's Mac mini, which operates the owner's ordinary signed-in `chatgpt.com` session and returns the answer. **Codex** is retained only as an optional secondary mode in the same UI and can be selected from the sidebar.

## Canonical production

- Vercel: `https://family-gpt-web.vercel.app`
- GitHub: `LewisKim7/Family-GPT-Web`

The previous `Family-GPT-API` / separate `family-gpt` Vercel project is retired. Its useful Codex research is preserved under [`docs/legacy-codex/`](docs/legacy-codex/).

## Architecture

```text
Family browser
  -> family-gpt-web.vercel.app
  -> mode selector
       -> GPT Web (default)
            -> Vercel async job queue
            -> Mac mini outbound worker
            -> real Chrome / chatgpt.com
            -> GPT-5.6 Sol
       -> Codex (optional)
            -> same Vercel project
            -> shared ChatGPT Codex OAuth session
            -> Auto routes Luna / Terra / Sol
```

There is only one public Family GPT deployment. Mode switching happens inside the app; it does not switch domains or Vercel projects.

## GPT Web

The Mac mini worker remains the primary path. It makes outbound HTTPS requests only, so no home-network inbound port is required in the current worker-queue design. See [`docs/SETUP.md`](docs/SETUP.md).

## Codex

Codex is intentionally secondary. The public UI can use it only after the owner has connected a shared Codex session. Device-login start/poll actions are protected by the same private owner-worker bearer token used by the Mac mini worker; the browser cannot create or replace the shared Codex session by itself.

The old Codex implementation and routing research are archived under `docs/legacy-codex/` so the experiment can be revisited without keeping a second app or deployment alive.

## Verification

```bash
npm run check
python -m py_compile bridge/worker.py
```

> GPT Web automates the ChatGPT web product and is not the official OpenAI API. Web UI behavior and account policy can change. Codex mode is kept as a fallback/experimental path, not the default experience.
