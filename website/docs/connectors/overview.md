---
sidebar_position: 1
title: Overview
description: The connector layer — what's built in, the capability matrix, and how to register a connector at runtime.
---

# Connectors — Overview

A connector is the adapter between Chativa and your backend. It implements [`IConnector`](https://github.com/AimTune/chativa/blob/main/packages/core/src/domain/ports/IConnector.ts).

If "connector" is a new word, read [Concepts → Ports](../concepts.md#3-ports--the-contracts) first — the whole port idea is what makes Chativa transport-agnostic.

## Built-in connectors

| Package | Class | Best for |
|---|---|---|
| [`@chativa/connector-dummy`](./dummy.md) | `DummyConnector` | Development, tests, sandbox demos. Pure local mock. |
| [`@chativa/connector-websocket`](./websocket.md) | `WebSocketConnector` | Custom WS backend. JSON frames in/out. |
| [`@chativa/connector-signalr`](./signalr.md) | `SignalRConnector` | Microsoft SignalR hub. |
| [`@chativa/connector-directline`](./directline.md) | `DirectLineConnector` | Azure Bot Framework v3. Maps every activity type. |
| [`@chativa/connector-sse`](./sse.md) | `SseConnector` | Server-Sent Events stream + REST POST. |
| [`@chativa/connector-http`](./http.md) | `HttpConnector` | Plain REST polling — simplest deployment. |
| [Custom](./custom.md) | _your class_ | Anything else (REST, MQTT, gRPC, IPC…). |

## Registering and selecting a connector

```ts
import { ConnectorRegistry, chatStore } from "@chativa/core";
import { DirectLineConnector } from "@chativa/connector-directline";

ConnectorRegistry.register(new DirectLineConnector({ token: "..." }));
chatStore.getState().setConnector("directline");
```

Or via `<chat-iva connector="directline">` once it's registered.

## Capability matrix

All optional methods are feature-detected at runtime. A capability is "advertised" simply by implementing the method.

| Capability | Method | Dummy | WS | SignalR | DirectLine | SSE | HTTP |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Send message | `sendMessage` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Receive | `onMessage` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Connect / disconnect events | `onConnect` / `onDisconnect` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Typing indicator | `onTyping` | ✅ |   |   | ✅ | ✅ |   |
| File upload | `sendFile` | ✅ |   |   | ✅ |   |   |
| History pagination | `loadHistory` | ✅ |   |   | ✅ | ✅ | ✅ |
| Delivery / read status | `onMessageStatus` | ✅ |   |   | ✅ |   |   |
| Like / dislike feedback | `sendFeedback` | ✅ |   |   | ✅ |   |   |
| End-of-conversation survey | `sendSurvey` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GenUI streaming | `onGenUIChunk` | ✅ |   |   |   |   |   |
| Multi-conversation | `listConversations` & co | ✅ |   |   |   |   |   |

> Empty cells are connectors that simply don't implement the method — the corresponding UI feature degrades gracefully (e.g. the file upload button hides itself when `sendFile` is missing).

## Configuration

Each connector's options have a JSON Schema under [`schemas/connectors/`](https://github.com/AimTune/chativa/tree/main/schemas/connectors) — drop the `$schema` URL into a config file and your editor will validate it as you type.
