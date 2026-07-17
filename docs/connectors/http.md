# HttpConnector

Plain REST polling adapter. The simplest deployment — no WebSockets, no SSE, no SignalR. The connector POSTs outgoing messages and GETs new ones on a fixed interval.

```ts
import { HttpConnector } from "@chativa/connector-http";

ConnectorRegistry.register(
  new HttpConnector({
    url: "https://api.example.com/chat",
    pollInterval: 2000,
    headers: { Authorization: `Bearer ${token}` },
  })
);
chatStore.getState().setConnector("http");
```


> **Tool calls, GenUI and human-in-the-loop chips** work over this connector via the shared JSON frame vocabulary — see [Rich frames](./frames.md).

## Options

Schema: [`schemas/connectors/http.schema.json`](../../schemas/connectors/http.schema.json).

| Field | Default | Description |
|---|---|---|
| `url` _(required)_ | — | Base URL of the chat REST API. |
| `pollInterval` | `2000` | Polling interval in milliseconds. |
| `headers` | `{}` | Headers sent with every request. |
| `maxErrors` | `5` | After this many consecutive fetch errors, stop polling and report disconnect. |

## Wire format

| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/messages?cursor=...` | `GET` | — | `{ messages: IncomingMessage[], cursor?: string }` |
| `/messages` | `POST` | `OutgoingMessage` | 200 / 201, body ignored |
| `/survey` | `POST` | `SurveyPayload` | 200 / 201, body ignored |
| `/history?cursor=...` | `GET` _(optional)_ | — | `HistoryResult` |

The connector tracks the last seen cursor in memory (`_cursor`) and keeps requesting `?cursor=...` to fetch only new messages.

### Rich frames in a poll batch

A `messages` array isn't limited to chat bubbles — it can interleave any [rich frame](./frames.md). Polling carries the same vocabulary as the streaming connectors, just a batch at a time:

```json
{
  "messages": [
    { "type": "typing", "isTyping": true },
    { "type": "tool_call", "data": { "id": "c1", "name": "get_sales", "status": "running" } },
    { "type": "tool_call", "data": { "id": "c1", "name": "get_sales", "status": "completed", "result": "42 orders" } },
    { "type": "genui", "streamId": "s1", "chunk": { "type": "ui", "component": "sales-chart", "props": { "orders": 42 }, "id": 1 }, "done": true },
    { "type": "text", "id": "m1", "from": "bot", "data": { "text": "Generate the PDF?" }, "actions": [{ "label": "Approve" }] },
    { "id": "m2", "type": "text", "from": "bot", "data": { "text": "Anything else?" } }
  ],
  "cursor": "m2"
}
```

Everything except the last entry is routed to a dedicated handler; only `m1` (as quick-reply chips) and `m2` reach the transcript.

GenUI component events are POSTed back to `/messages` alongside normal sends:

```json
{ "type": "genui_event", "streamId": "s1", "eventType": "form_submit", "payload": { "email": "a@b.com" } }
```

Because chunks only arrive as fast as you poll, a GenUI stream renders in `pollInterval` steps rather than smoothly — send fewer, larger chunks here than you would over a socket.

## When to use it

Choose HTTP polling when:

- Your infra already exposes REST and you don't want to deploy a WebSocket layer.
- Latency tolerance is ≥ 1–2 seconds.
- You need predictable behaviour through corporate proxies / firewalls.

Pick a streaming connector ([SSE](./sse.md), [WebSocket](./websocket.md), [SignalR](./signalr.md), or [DirectLine](./directline.md)) when sub-second latency matters — tool-call traces and GenUI work here too, but they advance one poll at a time.
