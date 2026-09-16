# Legacy Codex architecture notes

Source snapshot: `LewisKim7/Family-GPT-API` at commit `78ee7862416bce1fda18c2e071153278ff7ddd4f` (2026-08-31).

## Original flow

```text
Owner: ChatGPT Codex device login
  -> access / refresh token
  -> shared session in Vercel Runtime Cache

Family browser
  -> optional family PIN
  -> /api/chat
  -> deterministic model router
  -> Luna / Terra / Sol
  -> optional native web search
```

## Session design

The experiment used `@openai-oauth/core` and `@openai-oauth/ai-sdk` rather than a developer OpenAI API key.

Important implementation ideas:

- `DEFAULT_OPENAI_OAUTH_CLIENT_ID` was used for the Codex device flow.
- `refreshOpenAIOAuthTokens()` refreshed the shared owner session before access-token expiry.
- `deriveAccountId()` recovered the ChatGPT account id from token claims when needed.
- Access/refresh tokens and account id were stored in Vercel Runtime Cache with a 30-day TTL.
- The old implementation kept an HttpOnly browser backup of the shared token state to recover from cache loss.
- Family access used a separate random access secret and PIN hash, rather than exposing OAuth credentials to family browsers.

## Device login design

1. POST `https://auth.openai.com/api/accounts/deviceauth/usercode` with the Codex OAuth client id.
2. Show the returned user code and `https://auth.openai.com/codex/device` to the owner.
3. Poll `https://auth.openai.com/api/accounts/deviceauth/token`.
4. Exchange the returned authorization code + verifier using `exchangeOpenAIOAuthCode()`.
5. Verify the refresh token immediately and persist the resulting shared session.

The unified `Family-GPT-Web` keeps a simplified version of this research behind owner authorization for the optional Codex mode.

## Model router research

The old app exposed four client choices:

- `Auto`
- `GPT-5.6 Luna`
- `GPT-5.6 Terra`
- `GPT-5.6 Sol`

`Auto` was deterministic and local; it did **not** spend an extra model call. The router considered:

- explicit light tasks such as short translation/correction/summary -> Luna
- current-info/search questions -> Terra
- deep analysis, strategy, complex coding/math, long multi-step prompts -> Sol
- high quota usage -> suppress Sol and favor Terra/Luna

The old implementation also read `https://chatgpt.com/backend-api/wham/usage` and cached the result for 60 seconds.

## Web-search research

The retired app exposed the OpenAI web-search tool when enabled and could force a search for prompts containing explicit lookup language or freshness indicators such as latest/current/today/news/price/schedule.

That feature is preserved as research only for now. The optional Codex mode in the unified app is intentionally smaller; GPT Web remains the primary experience.

## Why the separate app was retired

Maintaining two GitHub apps and two Vercel projects created unnecessary ambiguity. The product decision is now:

- one source of truth: `Family-GPT-Web`
- one public Vercel project
- GPT Web default
- Codex as a secondary sidebar mode only
