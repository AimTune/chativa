---
sidebar_position: 3
title: WebSocket
description: Native browser WebSocket adapter — JSON frames in/out, configurable reconnect.
---

# WebSocketConnector

Native browser WebSocket adapter. The connector serialises every `OutgoingMessage` to JSON; incoming text frames are parsed as JSON and treated as `IncomingMessage`. Plain text frames are wrapped in a `text` message as a fallback.

```ts
import { WebSocketConnector } from "@chativa/connector-websocket";
import { ConnectorRegistry, chatStore } from "@chativa/core";

ConnectorRegistry.register(
  new WebSocketConnector({
    url: "wss://my-server.example.com/chat",
    reconnect: true,
    reconnectDelay: 2000,
    maxReconnectAttempts: 5,
  })
);
chatStore.getState().setConnector("websocket");
```


> **Tool calls, GenUI and human-in-the-loop chips** work over this connector via the shared JSON frame vocabulary — see [Rich frames](./frames.md).

## Options

Schema: [`schemas/connectors/websocket.schema.json`](https://github.com/AimTune/chativa/blob/main/schemas/connectors/websocket.schema.json).

| Field | Default | Description |
|---|---|---|
| `url` _(required)_ | — | `ws://` or `wss://` endpoint. |
| `protocols` | `[]` | Sub-protocol(s) passed to the `WebSocket` constructor. |
| `reconnect` | `true` | Auto-reconnect on socket close. |
| `reconnectDelay` | `2000` | Milliseconds between reconnect attempts. |
| `maxReconnectAttempts` | `5` | Stop reconnecting after this many failed attempts. |

## Wire format

### Inbound (server → client)

Each text frame must be a JSON-encoded `IncomingMessage`. See [`schemas/messages/incoming-message.schema.json`](https://github.com/AimTune/chativa/blob/main/schemas/messages/incoming-message.schema.json).

```json
{ "id": "1", "type": "text", "from": "bot", "data": { "text": "Hello!" }, "timestamp": 1735689600000 }
```

Plain text frames are tolerated — the connector wraps them as `{ type: "text", data: { text } }`.

Beyond plain messages, these [rich frames](./frames.md) are routed to their own handlers instead of the transcript:

```json
{ "type": "typing", "isTyping": true }
{ "type": "tool_call", "data": { "id": "c1", "name": "get_weather", "status": "running" } }
{ "type": "genui", "streamId": "s1", "chunk": { "type": "ui", "component": "weather", "props": { "temp": 18 }, "id": 1 }, "done": true }
{ "type": "text", "id": "m1", "data": { "text": "Deploy?" }, "actions": [{ "label": "Approve" }] }
```

### Outbound (client → server)

`OutgoingMessage` JSON, plus the special survey frame:

```json
{ "type": "survey", "rating": 5, "comment": "Great", "kind": 1 }
```

…and the GenUI component event, sent when a mounted component fires one:

```json
{ "type": "genui_event", "streamId": "s1", "eventType": "form_submit", "payload": { "email": "a@b.com" } }
```

### Server example

A Node server using [`ws`](https://github.com/websockets/ws) — an echo bot that shows a tool call, streams a GenUI card, then asks for approval:

```js
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (socket) => {
  const send = (frame) => socket.send(JSON.stringify(frame));

  socket.on("message", async (raw) => {
    const msg = JSON.parse(raw.toString());

    // A GenUI component event coming back from the client.
    if (msg.type === "genui_event") {
      console.log("component event:", msg.eventType, msg.payload);
      return;
    }

    send({ type: "typing", isTyping: true });

    // A tool call: same id, re-sent as it advances.
    send({ type: "tool_call", data: { id: "c1", name: "get_weather", status: "running", params: { city: "Ankara" } } });
    send({ type: "tool_call", data: { id: "c1", name: "get_weather", status: "completed", result: "18°C" } });

    // Stream a GenUI card into the bubble.
    send({ type: "genui", streamId: "s1", chunk: { type: "text", content: "Here's the forecast:", id: 1 }, done: false });
    send({ type: "genui", streamId: "s1", chunk: { type: "ui", component: "weather", props: { city: "Ankara", temp: 18 }, id: 2 }, done: true });

    send({ type: "typing", isTyping: false });

    // Ask a question — the chips are the human-in-the-loop interrupt.
    send({
      type: "text",
      id: "m1",
      from: "bot",
      data: { text: "Send this forecast by email?" },
      actions: [{ label: "Yes", value: "send_email" }, { label: "No" }],
    });
  });
});
```

The chip the user taps arrives as an ordinary user message (`"send_email"`), so there's no special resume channel to implement.

## Limitations

This connector is deliberately thin. It doesn't implement `loadHistory`, `sendFile` or `onMessageStatus` — if you need those, either fork it or [write a custom connector](./custom.md).

It *does* handle tool calls, GenUI streaming, typing and HITL chips — see [Rich frames](./frames.md).
