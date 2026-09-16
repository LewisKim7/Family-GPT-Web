# Legacy Codex research archive

This directory preserves the useful work from the retired `LewisKim7/Family-GPT-API` experiment. The original app used a shared ChatGPT Plus Codex OAuth session in Vercel Runtime Cache and exposed Auto/Luna/Terra/Sol routing. It is no longer a separate production app.

## What was learned

- A single shared ChatGPT Codex OAuth session can be refreshed and stored server-side without an OpenAI API key.
- Device authorization can establish the owner session, after which family requests can reuse it.
- A deterministic local router can choose Luna / Terra / Sol without spending a second model call.
- Codex usage pressure can be read from the ChatGPT usage endpoint and used to suppress expensive model choices when quota is high.
- The old implementation supported optional native web search and family PIN protection.

## Decision

The canonical product is now `Family-GPT-Web`, with **GPT Web as the default mode**. Codex survives only as a secondary sidebar mode in the same site. There is no separate Codex Vercel app.

## Preserved material

- `ARCHITECTURE.md` — OAuth session, device login, routing, quota, and web-search research
- `ORIGINAL_README.md` — product behavior and architecture of the retired prototype
- Git history link: `LewisKim7/Family-GPT-API@78ee7862416bce1fda18c2e071153278ff7ddd4f`

The old repository remains only as a historical pointer and Git history; new work belongs in `Family-GPT-Web`.
