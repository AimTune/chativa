---
sidebar_position: 1
title: Overview
description: How message types work — the IncomingMessage contract, MessageTypeRegistry, and resolution order.
---

# Message types — Overview

Every message that arrives via `IConnector.onMessage` carries a `type` string. The widget looks that type up in `MessageTypeRegistry` and renders the matching LitElement.

```ts
interface IncomingMessage {
  id: string;
  type: string;                      // ← key into MessageTypeRegistry
  from?: "bot" | "user";
  data: Record<string, unknown>;     // ← shape depends on type
  timestamp?: number;
  actions?: MessageAction[];         // optional quick-reply chips
}
```

Schema: [`schemas/messages/incoming-message.schema.json`](https://github.com/AimTune/chativa/blob/main/schemas/messages/incoming-message.schema.json).

| Topic | Page |
|---|---|
| Built-in types and their `data` shapes | [Built-in](./built-in.md) |
| Register your own component for a type | [Custom](./custom.md) |

## Resolution order

1. `MessageTypeRegistry.get(type)` — matches an explicitly registered renderer.
2. Falls back to the built-in `text` renderer for safety.

## Registries are singletons

```ts
import { MessageTypeRegistry } from "@chativa/core";

MessageTypeRegistry.register("product-card", ProductCardMessage);
MessageTypeRegistry.has("product-card");      // true
MessageTypeRegistry.get("product-card");      // ProductCardMessage
MessageTypeRegistry.list();                    // ["text", "image", ..., "product-card"]
MessageTypeRegistry.clear();                   // tests only
```

Built-in types are auto-registered on import of `@chativa/ui`. Re-registering a name overrides it — useful when you want to swap the default `card` renderer for your own.

## Feedback buttons

Every bot message gets like / dislike buttons, **whatever its type** — `text`, `buttons`, `card`, `carousel`, `image`, a custom renderer or a GenUI message. The buttons are not part of the message component: `chat-message-list` renders a `<message-feedback>` element under each bot message, so custom renderers get feedback without implementing anything. User messages never show them.

- They appear on hover / keyboard focus, and stay visible once a value is selected. On touch devices (no hover) they are always visible.
- A click dispatches a `chativa-feedback` event (`{ messageId, feedback: "like" | "dislike" }`), which the widget forwards to `IConnector.sendFeedback`.
- If the message's `data.feedbackDisabled` is `true`, the buttons are locked and `data.feedbackType` (`0` = like, `1` = dislike) shows the confirmed choice — this is how DirectLine's `DisableFeedbackButton` event is reflected.
