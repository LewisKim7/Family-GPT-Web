# Family GPT — retired Codex-only prototype

This note preserves the product behavior of the old `Family-GPT-API` repository before retirement.

The prototype was a lightweight ChatGPT-style family client backed by one shared ChatGPT Plus Codex session.

## Default experience in the retired prototype

```text
Auto
  -> GPT-5.6 Luna   lightweight / quota-saving work
  -> GPT-5.6 Terra  normal balanced work and current-info/search questions
  -> GPT-5.6 Sol    genuinely difficult work
Web Search          automatic by default, user-toggleable
```

Auto routing was deterministic and local. It used prompt shape plus the already-available 5-hour/weekly Codex usage snapshot, so model routing itself consumed no additional inference allowance.

Reasoning was kept at `medium` for all three models. Search context was reduced when quota pressure was high.

## Retired architecture

```text
Owner: one-time ChatGPT Codex device login
        -> shared Codex session in Vercel Runtime Cache
        -> browser HttpOnly backup for cache-loss recovery
        -> fixed family PIN policy

Family browser
        -> family PIN once
        -> HttpOnly family-access cookie
        -> /api/chat
        -> quota-aware Auto router
        -> Luna / Terra / Sol
        -> optional native Codex web search
```

No developer OpenAI API key, Supabase, Neon, or application database was required. Conversation history stayed in browser localStorage with server-side guards on message count and total characters.

## Security ideas retained from the experiment

- OAuth refresh token never committed to GitHub.
- Shared session remained server-side.
- Family access token was separate from OAuth credentials.
- Family PIN attempts were rate-limited.
- Arbitrary model IDs from the browser were ignored; the server mapped only known modes.

The active product is now `Family-GPT-Web`; this document exists only to retain the research trail.
