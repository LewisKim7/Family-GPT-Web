# Family GPT Web

A small family chat UI that delegates messages to a **visible, signed-in ChatGPT web session** running in a dedicated Chrome profile on the owner's PC.

## Architecture

```text
Family browser
  -> Vercel static UI
  -> Vercel /api (PIN session + thin proxy)
  -> authenticated private tunnel
  -> local Family Bridge
  -> serialized job queue
  -> Chrome CDP / Playwright
  -> visible chatgpt.com Plus session
```

## Why this shape

- No OpenAI API key in Vercel.
- No ChatGPT cookies or OAuth refresh tokens in Vercel.
- No Supabase or Neon required.
- Long ChatGPT responses use submit + job polling instead of holding one Vercel function open.
- One queue prevents multiple family requests from racing the same ChatGPT tab.
- Each family identity can point to a separate ChatGPT Project URL.

## Quick checks

```bash
npm run check
cd bridge && npm run check
```

See [docs/SETUP.md](docs/SETUP.md) for owner-PC and Vercel setup.

> This is browser automation over the ChatGPT web UI, not the official OpenAI API. It requires an active signed-in browser session and can break when the ChatGPT UI changes. Review applicable OpenAI terms before use.
