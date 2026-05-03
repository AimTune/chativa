---
sidebar_position: 7
title: HTTP
description: Plain REST polling adapter — the simplest deployment, no streaming infra required.
---

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

## Options

Schema: [`schemas/connectors/http.schema.json`](https://github.com/AimTune/chativa/blob/main/schemas/connectors/http.schema.json).

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

## When to use it

Choose HTTP polling when:

- Your infra already exposes REST and you don't want to deploy a WebSocket layer.
- Latency tolerance is ≥ 1–2 seconds.
- You need predictable behaviour through corporate proxies / firewalls.

Pick a streaming connector ([SSE](./sse.md), [WebSocket](./websocket.md), [SignalR](./signalr.md), or [DirectLine](./directline.md)) when sub-second latency or typing indicators matter.
