# Message Types — Overview

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

Schema: [`schemas/messages/incoming-message.schema.json`](../../schemas/messages/incoming-message.schema.json).

| Topic | Page |
|---|---|
| Built-in types and their `data` shapes | [built-in.md](./built-in.md) |
| Register your own component for a type | [custom.md](./custom.md) |

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
