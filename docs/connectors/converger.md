# ConvergerConnector

Client for [Converger](https://github.com/AimTune/converger) channel hubs. Converger sits between Chativa and your bots and agents: it issues tokens, stores the transcript, replays by watermark, tracks delivery and read receipts, hosts uploads, and routes the same conversation to WhatsApp, Telegram, Slack, email or SMS.

Converger Protocol v1 is a superset of mekik/1, so `ConvergerConnector` is a thin extension of [`MekikConnector`](./mekik.md): the same socket, auth providers, reconnect, offline queue, watermark resume, tool calls, GenUI and interrupts. On top of that it asks for the full protocol and adds what only the hub has:

- **acks** — every turn carries a `clientId`; `sendMessage` resolves when Converger has stored it, and the bubble turns `failed` when the hub refuses it;
- **receipts** — `deliveryStatus` frames drive the ticks: `sent`, `delivered`, `read`, `failed`;
- **uploads** (`sendFile`), **history paging** (`loadHistory`) and **reactions** (`sendFeedback`) over Converger's REST API;
- **agent panel** — `listConversations`, `createConversation`, `switchConversation`, `closeConversation`, `onConversationUpdate` with a channel-scoped token.

To use the plain mekik connector against Converger instead (no receipts, no uploads), see [mekik → Behind Converger](./mekik.md#behind-converger).

```ts
import { ConvergerConnector, TokenAuth } from "@chativa/connector-converger";
import { ConnectorRegistry, chatStore } from "@chativa/core";

const connector = new ConvergerConnector({
  url: "wss://chat.example.com/socket/converger/v1",
  // Your backend's token endpoint (below). A function, so an expired token is replaced.
  auth: new TokenAuth({
    token: async () => (await (await fetch("/api/chat-token", { method: "POST" })).json()).token,
  }),
  conversationId,          // from POST /api/v1/converger/conversations, or omit to let welcome name a new one
  routeInUrl: true,
  resumeConversation: true,
});

ConnectorRegistry.register(connector);
chatStore.getState().setConnector("converger");
```

The package re-exports `TokenAuth`, `CookieAuth` and `MekikConnector`, so one import is enough. A site without a backend uses [`PublishableKeyAuth`](#publishable-keys) instead of a token endpoint.

## Options

Every [`MekikConnectorOptions`](./mekik.md#options) field applies unchanged (`url`, `auth`, `reconnect*`, `routeInUrl`, `queueOfflineMessages`, `userId`, `conversationId`, `resumeConversation`, `onAuthError`, `tools`, `skills`, …). The Converger-only ones:

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | — | **Required.** The native endpoint, `wss://HOST/socket/converger/v1`. |
| `protocols` | `string \| string[]` | `["converger.v1"]` | The full protocol. (No subprotocol would get the mekik/1 profile, without acks or receipts.) |
| `apiUrl` | `string` | derived | Client API base. Default: same host as `url`, `ws:` → `http:`, `wss:` → `https:`, path `/api/v1/converger`. |
| `channelScoped` | `boolean` | `false` | The `auth` provider yields a channel-scoped token (agent consoles). See [Agent panel](#agent-panel). |
| `historyPageSize` | `number` | `50` | Frames per `loadHistory` page. `0` turns REST history off and the socket replays the whole transcript. |
| `ackTimeout` | `number` (ms) | `15000` | How long a send waits for its `ack` before it is marked `failed`. `0` waits forever. |
| `maxSendRetries` | `number` | `2` | Re-sends (same `clientId`) after a retryable error: `rate_limited`, `too_many_in_flight`, `unavailable`, `internal`, `busy`, or any error with `retryable: true`. |
| `readReceipts` | `boolean` | `true` | Send `read` receipts for the other side's messages while the widget is open. |
| `feedbackReactions` | `{ like?, dislike? }` | `👍` / `👎` | The reaction text `sendFeedback` posts. |

JSON Schema: [`schemas/connectors/converger.schema.json`](../../schemas/connectors/converger.schema.json).

## Tokens

The browser never sees the channel secret. A small endpoint of yours exchanges it for a short-lived Converger token and returns it:

```bash
curl -s -X POST "$CONVERGER/api/v1/converger/tokens/generate" \
  -H "authorization: Bearer $CHANNEL_SECRET" \
  -H "content-type: application/json" \
  -d '{"user": {"id": "user-42"}}'
# → { "token": "eyJ…", "expires_in": 1800, "conversationId": null, "permissions": null }
```

Pass a **function** to `TokenAuth`: it runs before every socket, so a reconnect after expiry gets a fresh token. The same token authorizes the REST calls (upload, history, reactions, conversation list); a REST call answered `401` asks the provider once for a new token and retries. On the socket, Converger's `token_expired` and `token_revoked` are handled like mekik's `unauthorized`: the provider decides whether to retry, and the reconnect resumes from the same watermark, so nothing is lost.

`tokens/generate` is rate limited (10 per minute per channel by default) — cache the token on your side for its lifetime rather than minting one per page view.

Converger's REST API is cross-origin from your page: add your site's origin to Converger's `CORS_ORIGINS`.

## Publishable keys

> Needs a Converger with publishable keys ([AimTune/converger#195](https://github.com/AimTune/converger/issues/195)).

A site with no backend of its own can use the channel's **publishable key** (`cvg_pk_...`) instead of a token endpoint. The key is safe to ship in page code: Converger only accepts it from the channel's allowed origins, and the tokens it yields are bound to one anonymous conversation.

```ts
import { ConvergerConnector, PublishableKeyAuth } from "@chativa/connector-converger";

const connector = new ConvergerConnector({
  url: "wss://chat.example.com/socket/converger/v1",
  auth: new PublishableKeyAuth({
    baseUrl: "https://chat.example.com",
    publishableKey: "cvg_pk_...",
  }),
});
```

`PublishableKeyAuth` calls `POST /api/v1/converger/tokens/publishable` with the key as bearer:

```bash
curl -s -X POST "$CONVERGER/api/v1/converger/tokens/publishable" \
  -H "authorization: Bearer cvg_pk_..." \
  -H "content-type: application/json" \
  -d '{"resume": "<from the previous answer>"}'
# → { "conversationId": "…", "token": "eyJ…", "expires_in": 1800, "userId": "anon_…", "resume": "…", "resumed": true }
```

- **Resume.** The answer's `resume` credential and `conversationId` are kept in `localStorage` under `chativa:converger:pk:<key>`, and `resume` goes with the next exchange, so a reload continues the same conversation, history included. When `resume` is missing, expired or for another channel, Converger starts a new conversation (`resumed: false`) and the stored one is replaced.
- **The conversation is the token's.** The connector asks for the credential before it connects and adopts its `conversationId` (and `userId`), over any `conversationId` option or one stored by `resumeConversation`. A different conversation than before starts from an empty watermark.
- **Rejected tokens.** The token is cached until a minute before `expires_in` runs out. When the socket rejects it (`token_expired`, `token_revoked`) or a REST call gets `401`, the key is exchanged again with `resume` for a fresh token.
- **Errors.** A failed exchange fails `connect()` with a `ConvergerApiError`: `401 unauthorized` (unknown or disabled key), `403 origin_not_allowed` (the page's origin is not allowed for the channel), `429 rate_limited` with `retryAfterMs` from the `retry-after` header.

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | — | **Required.** Converger's base URL (`https://chat.example.com`); the client API base (`…/api/v1/converger`) works too. |
| `publishableKey` | `string` | — | **Required.** The channel's `cvg_pk_...` key. |
| `storage` | `Storage \| null` | `localStorage` | Where `resume` and the conversation id are kept. `null` keeps them in memory: a reload starts a new conversation. Every access is guarded, so blocked storage (private mode, sandboxed iframes) behaves like `null`. |
| `storageKey` | `string` | `chativa:converger:pk:<key>` | The storage key. |
| `maxRetries` | `number` | `1` | Re-exchanges after a rejected token before the connection gives up. |

`auth.conversationId` is the current (or stored) conversation; `await auth.session()` returns the current `{ conversationId, token, expiresAt, userId, resumed }`, exchanging when needed (`{ fresh: true }` always exchanges); `auth.forget()` drops the stored `resume`, so the next connection starts a new conversation. `PublishableKeyAuth` is a plain auth provider, so `MekikConnector` takes it too ([mekik → Behind Converger](./mekik.md#behind-converger)): it then joins the token's conversation, which `welcome` names.

## Acks and receipts

Each user turn goes out with `clientId` set to the message id Chativa stamped on it:

```json
{ "type": "text", "id": "1760432123-k3j9x2a", "clientId": "1760432123-k3j9x2a", "data": { "text": "Where is my order?" } }
```

| Server frame | What happens |
|---|---|
| `ack {clientId, id, seq}` | `sendMessage` resolves; status `sent`. The activity `id` and `seq` are remembered for later receipts. |
| `error {clientId, code}` retryable | Sent again with the same `clientId` after `retryAfterMs` (Converger de-duplicates it), up to `maxSendRetries`. |
| `error {clientId, code}` otherwise | `sendMessage` rejects with a `ConvergerApiError` (`code`, e.g. `conversation_closed`); status `failed`. |
| no ack within `ackTimeout` | Status `failed`; `sendMessage` rejects. |
| `deliveryStatus {activityId, status}` | `queued` / `sent` → `sent`, `delivered` → `delivered`, `read` → `read`, `failed` → `failed`. |
| `deliveryStatus {upToSeq, status: "read"}` | Every message of ours up to that `seq` → `read`. |

Statuses only move forward (`sent` → `delivered` → `read`); a `failed` never overrides `delivered` or `read`. The widget draws `delivered` as a muted double tick, `read` as a double tick in the primary colour and `failed` as a red mark. Turns still unacked when the socket drops are sent again after the next `welcome`, with their original `clientId`. A Converger that does not announce `capabilities.acks` in `welcome` resolves sends as soon as they are on the wire.

The connector sends `read {watermark}` for the other side's live messages (debounced) while the widget is open, so their sender's ticks turn to read; turn it off with `readReceipts: false`. It also sends `ping` frames at half of `welcome.data.limits.idleTimeoutMs`, which keeps an idle full-protocol connection from being closed with 4408.

## Uploads

`sendFile(file, { caption })` posts the file to `POST /api/v1/converger/conversations/:id/upload` (multipart: `file`, plus an `activity` with the caption as `text` and any other metadata as `channelData`). The answer carries the attachment message as the socket delivers it; the connector shows it at once — with a local `blob:` preview of the bytes you just sent — and drops the socket copy of the same activity.

Messages with attachments, from either side, become Chativa's `image` (`image/*`), `video` (`video/*`) or `file` messages. Converger serves `/attachments/:id` only with an `Authorization` header, which an `<img>` cannot send: when Chativa injects its context (it does in the widget), the connector downloads the file with the token and points the bubble at an object URL. A storage backend that answers with a signed redirect needs nothing extra.

Upload limits and the allowed content types are Converger's (10 MB and a sniffed allowlist by default); a refusal rejects `sendFile` with a `ConvergerApiError` (`status` 413, 415, …).

## History

The widget opens at the latest messages and loads older ones on scroll:

1. On `connect()` for a known conversation with no resume point, the connector fetches the newest page — `GET .../activities?direction=backward&format=frames&limit=<historyPageSize>` — **before** opening the socket, and starts the socket's replay just above it. The first `loadHistory()` returns that page, so nothing is shown twice.
2. `loadHistory(cursor)` fetches the next older page with `before=<cursor>`. The cursor is a Converger `seq`; `hasMore` is false at the first activity.
3. When the socket resumes from a stored watermark (`resumeConversation`, a reconnect, or a conversation switched back to), `loadHistory()` without a cursor starts just below it.

History frames are mapped like live ones: text and rich messages, quick-reply chips, attachments. `tool_call`, `genui`, `interrupt`, `event` and `conversationUpdate` frames are not part of a history page. Your own turns keep the id Chativa gave them (their `clientId`), so a replayed copy de-duplicates against the bubble on screen.

## Reactions

`sendFeedback(messageId, "like" | "dislike")` posts a `messageReaction` activity (`replyToId` = the message's activity id, `text` = `feedbackReactions.like` / `.dislike`). Converger fans it out as an `event` frame, which the connector does not render.

## Agent panel

One agent, many conversations ([multi-conversation mode](../multi-conversation.md)) runs on a **channel-scoped** token. Your agent console's backend mints it with `{"scope": "channel", "user": {"id": "agent-7"}}`:

```ts
const connector = new ConvergerConnector({
  url: "wss://chat.example.com/socket/converger/v1",
  auth: new TokenAuth({ token: () => fetchAgentToken() }), // scope: "channel"
  channelScoped: true,
});
```

| Method | Converger |
|---|---|
| `connect()` | Opens nothing until a conversation is chosen (and reports connected). |
| `listConversations()` | `GET /conversations?limit=100`, most recently active first. `status: "active"` → `"open"`; `title` is the conversation's title, else the contact; `lastSeq` is kept to start each conversation just below its newest page. |
| `createConversation(title?)` | `POST /conversations {title}`; the conversation-bound token it returns is cached. |
| `switchConversation(id)` | Exchanges the channel token for a conversation-bound one (`GET /conversations/:id`, cached until 60 s before it expires) and reconnects the socket for that conversation, resuming where this connector left it. Unacked sends of the conversation it leaves are failed. |
| `closeConversation(id)` | `POST /conversations/:id/close`. |
| `onConversationUpdate(cb)` | `conversationUpdate` frames (`conversation_closed`, `conversation_ended` → `closed`, `conversation_reopened` → `open`) and the last-message preview of the active conversation. |

The bound token carries the agent's `user_id`, so the agent's own turns are `from: "user"` on its side (right-hand bubbles) and the customer's are `from: "bot"`, and receipts work per message as in the widget.

**One socket for the active conversation.** Converger also offers a channel-scoped socket that multiplexes every conversation of a `websocket` channel in `{conversationId, frame}` envelopes (Protocol v1 section 10, AimTune/converger#64). The connector does not use it: `from` on that socket is relative to the end user (an agent's own turns would render on the wrong side), Chativa's agent panel shows one conversation at a time anyway, and the extended `MekikConnector` tracks one conversation and one watermark per socket. Switching costs one reconnect; the other conversations' list entries refresh on `listConversations()`.

## Frames

Everything in [mekik → Frame mapping](./mekik.md#frame-mapping) applies. In addition:

| Frame | Direction | Handling |
|---|---|---|
| `hello.protocol: "converger/1"` | → | Sent with every handshake, next to the `converger.v1` subprotocol. |
| `text` … `clientId` | → | Every user turn (see [Acks and receipts](#acks-and-receipts)). |
| `read {watermark}` | → | Read receipts. |
| `ping` | → | Keepalive at half the idle timeout. |
| `ack`, `deliveryStatus` | ← | Receipts; never rendered. |
| `conversationUpdate` | ← | `onConversationUpdate`; never rendered. |
| `event` | ← | Reactions, edits and deletes of other activities; not rendered. |
| `heartbeat`, `presence`, `tokenRefreshed`, `replayTruncated` | ← | Consumed, not rendered. |
| `error` `token_expired` / `token_revoked` | ← | Treated as an auth rejection (provider-driven retry). |

## Extending

`MekikConnector` exposes the hooks this connector is built on, for your own subclass: `encodeTurn(message)` (the wire shape of a user turn), `interceptFrame(frame)` (claim or rewrite a parsed frame before the mekik routing; return `true` to consume it) and `helloExtras()` (fields added to `hello`), plus the protected `ws`, `options`, `watermark`, `messageHandler`, `connectHandler` and `sendOrQueue`.

## Not yet

- **Mid-session token refresh** (`auth` frame before `welcome.data.expiresAt`): the connector reconnects with a fresh token instead, which is lossless.
- **`replayTruncated`**: a replay longer than `replayMax` (10 000 frames) is not paged in automatically; the older part is reachable with `loadHistory`.
- **Presence and typing out**: `presence` frames are consumed but not surfaced, and the widget does not send `typing`.
- **Live frames of a mekik bot behind the hub** (`run`, `genui_components`, `skills`) and the frames forwarded to it (`resume`, `genui_event`, `survey`, …) depend on Converger's bot relay (AimTune/converger#64).
- **React Native**: `@chativa/rn-webview` does not offer this connector yet.

## Sandbox

The Connector tab has two presets: **mekik behind Converger** (connector-mekik, unchanged) and **Converger hub** (this connector). Each takes its token from the **Dev server** endpoint (`/api/converger-token`, which needs `pnpm dev` with `CONVERGER_URL` and `CONVERGER_CHANNEL_SECRET`), a pasted **Token**, or a **Publishable key**. `agent-panel.html?converger=http://localhost:4000` runs the agent panel on a channel-scoped token. Start Converger with `CORS_ORIGINS=http://localhost:5173`. See [Sandbox](../sandbox.md#converger).
