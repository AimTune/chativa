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

### Outbound (client → server)

`OutgoingMessage` JSON, plus the special survey frame:

```json
{ "type": "survey", "rating": 5, "comment": "Great", "kind": 1 }
```

## Limitations

This connector is intentionally minimal. It doesn't implement `loadHistory`, `sendFile`, `onMessageStatus`, `onTyping`, or `onGenUIChunk` — if you need those, either fork it or [write a custom connector](./custom.md).
