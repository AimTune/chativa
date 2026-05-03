---
sidebar_position: 2
title: Dummy
description: Local mock connector for development and tests — implements every IConnector capability.
---

# DummyConnector

Local mock connector for development and tests. No network, no backend required. Implements **every** `IConnector` capability — including history pagination, GenUI streaming, multi-conversation, file upload, message status, and survey — so the sandbox can demo each feature in isolation.

```ts
import { DummyConnector } from "@chativa/connector-dummy";
import { ConnectorRegistry, chatStore } from "@chativa/core";

ConnectorRegistry.register(
  new DummyConnector({ replyDelay: 500, connectDelay: 2000 })
);
chatStore.getState().setConnector("dummy");
```

## Options

Schema: [`schemas/connectors/dummy.schema.json`](https://github.com/AimTune/chativa/blob/main/schemas/connectors/dummy.schema.json).

| Field | Default | Description |
|---|---|---|
| `name` | `"dummy"` | Override the connector identifier (lets you register multiple dummies side by side). |
| `replyDelay` | `500` | Milliseconds before the echo reply is returned after a message is sent. |
| `connectDelay` | `2000` | Milliseconds to wait before `connect()` resolves — simulates a real handshake. Set to `0` in tests. |

## Demo helpers

`DummyConnector` exposes a few non-`IConnector` helpers for sandbox demos:

| Method | Purpose |
|---|---|
| `injectMessage(msg)` | Push a bot message directly into the UI without going through the extension pipeline. |
| `triggerGenUI(name)` | Fire one of the demo streams: `weather`, `form`, `alert`, `quick-replies`, `list`, `table`, `rating`, `progress`, `date-picker`, `chart`, `steps`, `image-gallery`, `typewriter`. |

## Built-in slash commands recognised by the connector

| Input | Effect |
|---|---|
| `/disconnect` | Calls `disconnect()` — useful for testing reconnect flows. |
| `/genui` | Triggers the multi-component demo stream (text + card + form + event). |
| `/genui-weather` | Streams a custom `weather` GenUI component (registered in the sandbox). |
| `/genui-form` | Streams an appointment form. |
