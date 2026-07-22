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


> **Tool calls, GenUI and human-in-the-loop chips** work over this connector via the shared JSON frame vocabulary — see [Rich frames](./frames.md).

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

Each event payload is JSON:

```
event: message
data: { "id": "1", "type": "text", "from": "bot", "data": { "text": "Hello!" } }

event: typing
data: { "isTyping": true }

event: connected
data: {}
```

A bare `data:` line without an `event:` field is also accepted as long as the JSON has both `id` and `type`.

A `data:` line may also carry any [rich frame](./frames.md) — those are routed to their own handlers instead of the transcript:

```
data: { "type": "tool_call", "data": { "id": "c1", "name": "search", "status": "running" } }

data: { "type": "genui", "streamId": "s1", "chunk": { "type": "ui", "component": "weather", "props": { "temp": 18 }, "id": 1 }, "done": true }

data: { "type": "text", "id": "m1", "data": { "text": "Deploy?" }, "actions": [{ "label": "Approve" }] }
```

### Outgoing (client → server)

POST `OutgoingMessage` to `sendUrl`. For surveys, the connector POSTs `{ "type": "survey", ...payload }`.

Because an SSE stream is receive-only, GenUI component events are POSTed to `sendUrl` too:

```json
{ "type": "genui_event", "streamId": "s1", "eventType": "form_submit", "payload": { "email": "a@b.com" } }
```

### Server example

An Express endpoint streaming a tool call, a GenUI card and a HITL question:

```js
app.get("/chat/stream", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const send = (frame) => res.write(`data: ${JSON.stringify(frame)}\n\n`);

  send({ type: "connected" });
  send({ type: "typing", isTyping: true });

  send({ type: "tool_call", data: { id: "c1", name: "get_weather", status: "running" } });
  send({ type: "tool_call", data: { id: "c1", name: "get_weather", status: "completed", result: "18°C" } });

  send({ type: "genui", streamId: "s1", chunk: { type: "ui", component: "weather", props: { temp: 18 }, id: 1 }, done: true });

  send({ type: "typing", isTyping: false });
  send({ type: "text", id: "m1", from: "bot", data: { text: "Email it?" }, actions: [{ label: "Yes" }, { label: "No" }] });
});

// The outbound half — plain messages, surveys and component events all land here.
app.post("/chat/send", express.json(), (req, res) => {
  if (req.body.type === "genui_event") {
    console.log("component event:", req.body.eventType, req.body.payload);
  }
  res.sendStatus(200);
});
```

### Optional history

`GET {url}/history?cursor=...` should return a `HistoryResult`:

```json
{ "messages": [...], "hasMore": true, "cursor": "next" }
```

See [`schemas/messages/history-result.schema.json`](../../schemas/messages/history-result.schema.json).
