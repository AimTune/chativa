# SseConnector

Server-Sent Events adapter. The browser opens an `EventSource` to read incoming messages, and POSTs outgoing messages to a separate endpoint. SSE is one-way (server → client), so the connector pairs it with a REST POST for sends.

```ts
import { SseConnector } from "@chativa/connector-sse";

ConnectorRegistry.register(
  new SseConnector({
    url: "https://api.example.com/chat/stream",
    sendUrl: "https://api.example.com/chat/send",
    headers: { Authorization: `Bearer ${token}` },
  })
);
chatStore.getState().setConnector("sse");
```

> **Note.** `EventSource` does not support custom request headers. If you need auth, pass tokens via `url` query params (e.g. `?token=...`).

## Options

Schema: [`schemas/connectors/sse.schema.json`](../../schemas/connectors/sse.schema.json).

| Field | Default | Description |
|---|---|---|
| `url` _(required)_ | — | SSE endpoint (the `EventSource` source URL). |
| `sendUrl` | `url` | POST URL for outgoing messages. |
| `headers` | `{}` | Headers sent with POSTs and the `loadHistory` GET. |
| `reconnect` | `true` | Re-initialise on `error` events. `EventSource` reconnects natively as well. |

## Wire format

### SSE stream (server → client)

Each event payload is JSON. The connector recognises three `type` values plus the default (treat as a message):

```
event: message
data: { "id": "1", "type": "text", "from": "bot", "data": { "text": "Hello!" } }

event: typing
data: { "isTyping": true }

event: connected
data: {}
```

A bare `data:` line without an `event:` field is also accepted as long as the JSON has both `id` and `type`.

### Outgoing (client → server)

POST `OutgoingMessage` to `sendUrl`. For surveys, the connector POSTs `{ "type": "survey", ...payload }`.

### Optional history

`GET {url}/history?cursor=...` should return a `HistoryResult`:

```json
{ "messages": [...], "hasMore": true, "cursor": "next" }
```

See [`schemas/messages/history-result.schema.json`](../../schemas/messages/history-result.schema.json).
