# MekikConnector

Client adapter for [mekik](https://github.com/AimTune/mekik) servers — Mekik Wire Protocol v1. Mekik is Chativa's server-side sibling: Chativa renders the chat, mekik runs the conversation. Because both sides speak one protocol, this connector gets identity handshake, watermark resume, tool-call lifecycle, typing, Generative UI streaming and human-in-the-loop chips with no per-app glue.

```ts
import { MekikConnector } from "@chativa/connector-mekik";
import { ConnectorRegistry, chatStore } from "@chativa/core";

ConnectorRegistry.register(
  new MekikConnector({
    url: "wss://bot.example.com/chat",
    resumeConversation: true,
  })
);
chatStore.getState().setConnector("mekik");
```

The wire protocol is transport-agnostic on the mekik side, but this connector speaks the **WebSocket** profile.

## Options

Schema: [`schemas/connectors/mekik.schema.json`](../../schemas/connectors/mekik.schema.json).

| Field | Default | Description |
|---|---|---|
| `url` | — | **Required.** mekik WebSocket endpoint, e.g. `wss://bot.example.com/chat`. |
| `protocols` | `[]` | Sub-protocol(s) passed to the `WebSocket` constructor. |
| `reconnect` | `true` | Auto-reconnect when the socket drops. Suppressed after an auth rejection. |
| `reconnectDelay` | `2000` | Milliseconds between reconnect attempts. |
| `maxReconnectAttempts` | `5` | Give up after this many consecutive failures. Reset on a successful handshake. |
| `queueOfflineMessages` | `true` | Hold outgoing messages while the socket is down and flush them on (re)connect. |
| `userId` | server-minted | Stable user identity. Omit to let the server generate one (announced via `welcome`). |
| `conversationId` | server-minted | Conversation to resume. Omit to start a new one. |
| `resumeConversation` | `false` | Persist identity + watermark in `localStorage` and resume across page reloads. |
| `auth` | — | How this client authenticates — a `MekikAuthProvider` adapter (`CookieAuth`, `TokenAuth`, or your own). Omit for servers that don't authenticate. See [Authentication](#authentication). |
| `token` | — | **Deprecated** — shorthand for `auth: new TokenAuth({ token, maxRetries: 0 })`. Still works. |
| `onAuthError` | — | Called when the server rejects the connection, whichever adapter is in use. |

## Frame mapping

Every mekik transport carries the same JSON frames. The connector routes them like this:

| mekik frame | Direction | Becomes |
|---|---|---|
| `hello` | client → server | Sent on open — `userId` / `conversationId` / `watermark` / `token`. All fields optional. |
| `welcome` | server → client | Identity + current watermark. Captured on `connector.identity`, never rendered as a message. |
| `text` (bot) | server → client | `text` message bubble. |
| `text` + `actions` | server → client | `quick-reply` message — chips render natively; tapping one answers the bot. |
| `text` (`from: "user"`) | server → client | Transcript replay / other-tab fan-out of the user's own messages. |
| `tool_call` | server → client | `onToolCall` — same `id` upserted `running` → `completed` / `error`. |
| `run` `{ status }` | server → client | Typing indicator: `started` → on, `finished` → off. |
| `genui` | server → client | `onGenUIChunk` — mounts a GenUI component inline. |
| `genui_event` | client → server | Sent when a mounted GenUI component fires an event (form submit, card action…). |
| `error` | server → client | Auth rejection — surfaced via `onAuthError`, followed by close code 4401. |
| `survey` | client → server | `sendSurvey()` payload. |

Unknown frame types and unknown fields are ignored on both sides — that's the protocol's forward-compatibility rule, so a newer server can't break an older client.

## Identity and resume

mekik identity is a triple: `userId`, `conversationId`, `connectionId`. You may assert any of them in the `hello` handshake; the server fills in whatever you omit and announces the result in `welcome`:

```ts
const connector = new MekikConnector({ url: "wss://bot.example.com/chat" });
await connector.connect();
connector.identity; // { conversationId, userId, connectionId, watermark }
```

Server-minted ids are adopted automatically, so the next reconnect resumes the same session.

**Watermark replay.** Persistent frames (`text`, `tool_call`, `genui`) carry a monotonic `seq`. The connector tracks the highest one it has seen and hands it back on reconnect, so the server replays only what you missed — the same resume model as DirectLine, and it covers multi-tab and multi-device out of the box.

With `resumeConversation: true` the identity and watermark are persisted to `localStorage` under `chativa:mekik:<url>`, so a page reload rejoins the same conversation mid-transcript. If the server answers with a *different* `conversationId` than the one you tried to resume (the old one expired, say), the watermark resets to zero — the old watermark belongs to a transcript that no longer exists.

## Authentication

By default mekik accepts every connection and identity is client-asserted. A server opts into authentication by configuring an **Authenticator** ([PROTOCOL.md §2.1](https://github.com/AimTune/mekik/blob/main/PROTOCOL.md)); that gate then applies to `connect()`.

Authentication is a port here, mirroring the server. Mekik's `Authenticator` (in `@mekik/core`) decides *whether a connection may open*; Chativa's `MekikAuthProvider` decides *what credential the client presents*. You pass an adapter as `auth` and the connector stays out of it:

```ts
import { MekikConnector, CookieAuth, TokenAuth } from "@chativa/connector-mekik";

new MekikConnector({ url, auth: new CookieAuth() });                  // cookie session
new MekikConnector({ url, auth: new TokenAuth({ token: "api-key" }) }); // API key / JWT
```

The split matters because a cookie session, a static API key and a short-lived JWT all reach the same server through the same wire fields, but they're obtained — and refreshed — in completely different ways. That variation belongs in the adapter, not in the connector.

| Chativa adapter (client) | mekik adapter (server) | Credential |
|---|---|---|
| `CookieAuth` | `CookieAuthenticator` | The browser's cookie — nothing to send |
| `TokenAuth` (string) | `StaticTokenAuthenticator` | A long-lived API key |
| `TokenAuth` (function) | `HmacJwtAuthenticator` | A short-lived JWT, re-minted per attempt |
| your own `MekikAuthProvider` | your own `Authenticator` | anything |

The provider is consulted **before every socket**, never once and cached — which is what lets a reconnect carry a credential that's still valid.

### Cookie sessions

If your server uses `CookieAuthenticator`, the client sends nothing: browsers attach cookies to the WebSocket handshake themselves, and mekik forwards request headers to its authenticator. This is the best option for same-site browser apps — the credential stays `HttpOnly` and never touches JavaScript.

```ts
new MekikConnector({
  url: "wss://bot.example.com/chat",
  auth: new CookieAuth({
    // Optional: renew an expired session, then retry the connection once.
    refresh: () => fetch("/api/session/refresh", { method: "POST" }),
  }),
});
```

`CookieAuth` contributes no credential by design; it exists to declare that intent in app code and to give an expiring session somewhere to refresh from. Omitting `auth` entirely works identically for a server that authenticates by cookie.

### Token credential

```ts
new MekikConnector({
  url: "wss://bot.example.com/chat",
  auth: new TokenAuth({ token: "eyJhbGciOiJIUzI1NiIs..." }),
});
```

A **static string is only right for a long-lived credential**. For short-lived JWTs pass a function — it runs on every attempt, so each one carries a fresh token instead of the one that was valid at page load:

```ts
auth: new TokenAuth({
  token: async () => {
    const res = await fetch("/api/chat-token", { credentials: "include" });
    return (await res.json()).token;
  },
});
```

This matters most after a long disconnect: the reconnect when a laptop wakes up is exactly when a page-load-time token has expired.

If the function throws, `connect()` rejects with that error. The connector deliberately does **not** fall back to connecting anonymously, which would report a token-endpoint outage as a misleading "unauthorized" from the server.

#### Transport

| `transport` | Credential rides in | Use when |
|---|---|---|
| `"hello"` (default) | The `hello` frame's `token` | Almost always. |
| `"query"` | `?token=` on the socket URL | Something upstream of mekik — an edge proxy or gateway authenticating at the HTTP upgrade — must read it. It never sees the `hello` frame. |

```ts
auth: new TokenAuth({ token, transport: "query", queryParam: "access_token" });
```

Prefer `"hello"`: a query token lands in server and proxy access logs. (mekik also accepts an `Authorization: Bearer` header, but browsers can't set headers on a WebSocket handshake, so it isn't reachable from this connector.)

### Rejection and retry

When the authenticator returns `ok: false`, mekik sends an `error` frame and closes with WebSocket code **4401**:

```json
{ "type": "error", "data": { "code": "unauthorized", "message": "invalid token" } }
```

The connector surfaces that through `onAuthError`, and blind auto-reconnect stays **off** — only the provider can know whether a better credential is obtainable, so it makes the call via `onReject`:

- `TokenAuth` with a **function** retries once by default (`maxRetries`), re-minting the token. A **static string** never retries — re-sending a string the server just refused cannot change the verdict.
- `CookieAuth` retries once if you gave it a `refresh`, and gives up if the refresh itself fails.

So the common expired-JWT flow needs no app code at all:

```ts
new MekikConnector({
  url,
  auth: new TokenAuth({ token: () => auth.freshAccessToken() }), // rejected → re-mint → retry
  onAuthError: (err) => redirectToLogin(err), // still fires; for terminal failures
});
```

The last rejection is readable at `connector.authError` (`null` unless the server refused this connection); it's cleared on the next `connect()`. An auth rejection is *not* a chat message — it never lands in the transcript.

### Writing your own provider

Implement the one-method port — the client mirror of writing your own `Authenticator` on the server:

```ts
import type { MekikAuthProvider } from "@chativa/connector-mekik";

const oidcAuth: MekikAuthProvider = {
  name: "oidc",
  async authenticate({ attempt, previousError }) {
    const token = await oidc.getAccessToken({ forceRefresh: attempt > 0 });
    return { token }; // or { query: { token } } for the query transport
  },
  onReject: (error, ctx) => (ctx.attempt < 2 ? "retry" : "fail"),
};

new MekikConnector({ url, auth: oidcAuth });
```

`authenticate()` receives the attempt number and the rejection that caused the retry, and returns a `MekikCredential` — `{ token }`, `{ query }`, or `{}` for "nothing to send".

### Verified identity

If the authenticator returns a `userId`, that is the **verified** identity and it overrides whatever the client asserted in `hello` — a valid token cannot be used to impersonate another user. Read the result from the `welcome` frame:

```ts
await connector.connect();
connector.identity?.userId; // the id the server verified, not necessarily the one you sent
```

Any `claims` the authenticator returns stay server-side, exposed to the runtime as `TurnContext.meta.auth` — they are not sent to the client.

### Pairing with the server

`new MekikConnector({ auth: new CookieAuth({ refresh }) })` pairs with a mekik server configured like this:

```ts
import { ConversationEngine } from "@mekik/core";
import { CookieAuthenticator, HmacJwtAuthenticator } from "@mekik/authentication";

const engine = new ConversationEngine({
  runtime,
  authenticator: new CookieAuthenticator({
    cookie: "mekik_session",
    inner: new HmacJwtAuthenticator({ secret: process.env.JWT_SECRET! }),
  }),
});
```

Authentication in mekik is **connection-time only** — it decides who may open a socket, and implies no authorization or RBAC beyond that.

## Human-in-the-loop

When a run needs an answer, mekik sends a `text` frame carrying `actions`. The connector maps it to Chativa's native `quick-reply` type, so the chips render without a custom component; tapping one sends the value back as the user's answer, which resumes the interrupted run:

```json
{ "type": "text", "seq": 43, "from": "bot",
  "data": { "text": "Deploy to production?" },
  "actions": [{ "label": "Approve" }, { "label": "Cancel" }] }
```

The chips are kept visible after the tap (`keepActions`) so the transcript still reads as a record of what was asked and answered.

## Tool calls

`tool_call` frames are a lifecycle, not a log: the same `id` is re-sent as its status advances, and Chativa upserts it in place.

```json
{ "type": "tool_call", "seq": 45, "data": {
    "id": "call-1", "name": "get_weather", "status": "running", "params": { "city": "Ankara" } } }
{ "type": "tool_call", "seq": 46, "data": {
    "id": "call-1", "name": "get_weather", "status": "completed", "result": "18°C" } }
```

## Generative UI

`genui` frames stream an [`AIChunk`](../genui/streaming.md) per `streamId`, mounting a registered GenUI component inline as it arrives. Events fired by that component travel back as `genui_event`, which makes GenUI bidirectional over the same socket:

```ts
connector.receiveComponentEvent("stream-1", "submit", { email: "a@b.com" });
// → { "type": "genui_event", "streamId": "stream-1", "eventType": "submit", "payload": {...} }
```

## Offline queue

With `queueOfflineMessages: true` (the default) a send that happens while the socket is down is queued and flushed on the next connect. The promise resolves **only when the payload actually reaches the wire**, so the bubble stays on "sending" instead of being stamped "sent" for a message the server never received.

## Capabilities

Implemented: `sendMessage`, `onMessage`, `onConnect` / `onDisconnect`, `onTyping`, `onToolCall`, `onGenUIChunk`, `receiveComponentEvent`, `sendSurvey`.

Not implemented: `sendFile`, `loadHistory` (watermark replay covers resume instead), `onMessageStatus`, `sendFeedback`, multi-conversation.
