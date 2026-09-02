# Family GPT Web

Public chat website backed by the owner's **ordinary signed-in ChatGPT web session**.
Visitors only open the Vercel site. They do not need an OpenAI API key, ChatGPT login, browser extension, or local setup.

## Runtime path

```text
visitor
  -> family-gpt-web.vercel.app
  -> Vercel /api/chat
  -> private authenticated relay on owner PC
  -> ChatGPT-Web2API
  -> dedicated signed-in Chrome profile
  -> chatgpt.com ordinary Chat
  -> GPT-5.6 Sol
  -> response returned to the visitor
```

The browser engine is [Octo-Lex/ChatGPT-Web2API](https://github.com/Octo-Lex/ChatGPT-Web2API), an MIT-licensed OpenAI-compatible gateway that drives a real Chrome session through CDP. This repo does not reimplement ChatGPT DOM automation.

## Important behavior

- Public visitors never receive the ChatGPT session, cookies, credentials, or local gateway key.
- The local relay serializes generations and limits queue length.
- Each visitor browser gets its own local `threadId`; the relay maps it to the ChatGPT `conversation_id` returned by ChatGPT-Web2API.
- The configured model defaults to `gpt-5.6-sol`. The relay first checks `/v1/models` and refuses to send if a matching GPT-5.6 Sol model is not visible in the signed-in account.
- No Supabase/Neon/database service is required. Local thread/job state lives under `bridge/data/`.

See [docs/SETUP.md](docs/SETUP.md).

> This is unofficial browser automation over ChatGPT web, not the official OpenAI API. It can break when the product changes and may conflict with OpenAI's terms for automated access/account sharing. Do not expose the local browser gateway itself to the public internet.
