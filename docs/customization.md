# Chativa — Customization Reference

All customization happens through a single `ThemeConfig` object. Pass any subset (deep partial) to the store:

```js
import chatStore from "chativa/application/stores/ChatStore";

chatStore.getState().setTheme({
  colors: { primary: "#0ea5e9" },
  position: "bottom-left",
  size: "large",
});
```

Or set it on the `<chat-bot-button>` element:

```js
document.querySelector("chat-bot-button").setTheme({ colors: { primary: "#0ea5e9" } });
```

---

## CSS Custom Properties

The widget exposes CSS variables that pierce Shadow DOM. Set them on `:root` or any ancestor:

| Variable | Default | Description |
|---|---|---|
| `--chativa-primary-color` | `#4f46e5` | Primary accent — button, user bubbles, header |
| `--chativa-primary-dark` | `#7c3aed` | Header gradient end, hover states |
| `--chativa-background` | `#ffffff` | Widget panel background |
| `--chativa-surface` | `#f8fafc` | Input field background |
| `--chativa-border` | `#e2e8f0` | Borders and dividers |
| `--chativa-text` | `#0f172a` | Primary text |
| `--chativa-text-muted` | `#64748b` | Timestamps, subtitles |
| `--chativa-bubble-bot-bg` | `#f1f5f9` | Bot message bubble background |
| `--chativa-bubble-bot-color` | `#0f172a` | Bot message bubble text |
| `--chativa-bubble-user-bg` | `var(--chativa-primary-color)` | User message bubble background |
| `--chativa-bubble-user-color` | `#ffffff` | User message bubble text |

---

## ThemeConfig Reference

Full JSON schema: [`theme.schema.json`](../theme.schema.json)

### `colors`

| Field | Type | Default | Description |
|---|---|---|---|
| `colors.primary` | `string` | `"#4f46e5"` | Main brand color |
| `colors.secondary` | `string` | `"#6c757d"` | Secondary accent |
| `colors.background` | `string` | `"#ffffff"` | Panel background |
| `colors.text` | `string` | `"#212529"` | Text color |
| `colors.border` | `string` | `"#dee2e6"` | Border color |

### `position`

| Value | Description |
|---|---|
| `"bottom-right"` *(default)* | Lower right corner |
| `"bottom-left"` | Lower left corner |
| `"top-right"` | Upper right corner |
| `"top-left"` | Upper left corner |

### `positionMargin`

Distance from the screen edge: `"1"` – `"5"` (each level ≈ 0.5rem).
Default: `"2"` (≈ 1rem).

### `size`

| Value | Button diameter |
|---|---|
| `"small"` | 44 px |
| `"medium"` *(default)* | 56 px |
| `"large"` | 68 px |

### `layout`

| Field | Default | Description |
|---|---|---|
| `layout.width` | `"360px"` | Panel width |
| `layout.height` | `"520px"` | Panel height |
| `layout.maxWidth` | `"100%"` | Max-width (responsive clamp) |
| `layout.maxHeight` | `"100%"` | Max-height |
| `layout.horizontalSpace` | `"2"` | Horizontal edge gap (1–5) |
| `layout.verticalSpace` | `"2"` | Gap between panel and button (1–5) |

---

## Connector Registration

Register a connector before the widget is opened:

```js
import { ConnectorRegistry } from "chativa/application/registries/ConnectorRegistry";
import { WebSocketConnector } from "chativa/infrastructure/connectors/WebSocketConnector";

ConnectorRegistry.register(
  new WebSocketConnector({ url: "wss://my-server/chat" })
);
```

Available built-in connectors:

| Connector | Class | Options |
|---|---|---|
| **Dummy** (dev/test) | `DummyConnector` | `replyDelay?: number` (ms), `connectDelay?: number` (ms, default 2000) |
| **WebSocket** | `WebSocketConnector` | `url: string`, `reconnectDelay?: number` |
| **SignalR** | `SignalRConnector` | `url: string`, `hubName?: string` |
| **DirectLine** | `DirectLineConnector` | `token: string`, `domain?: string` |

---

## Custom Message Types

Register a LitElement component to handle a custom message type:

```js
import { MessageTypeRegistry } from "chativa/application/registries/MessageTypeRegistry";
import "./MyCardMessage"; // registers <my-card-message>

MessageTypeRegistry.register(
  "card",
  customElements.get("my-card-message")
);
```

Your component receives these props:

| Property | Type | Description |
|---|---|---|
| `messageData` | `Record<string, unknown>` | The message `data` payload |
| `sender` | `"bot" \| "user"` | Who sent the message |
| `timestamp` | `number` | Unix timestamp (ms) |

---

## Extensions

Extensions hook into the message pipeline:

```js
import { ExtensionRegistry } from "chativa/application/registries/ExtensionRegistry";

ExtensionRegistry.install({
  name: "logger",
  version: "1.0.0",
  install(ctx) {
    ctx.onBeforeSend((msg) => {
      console.log("Sending:", msg);
      return msg; // return null to block
    });
    ctx.onAfterReceive((msg) => {
      console.log("Received:", msg);
      return msg; // return null to block
    });
    ctx.onWidgetOpen(() => console.log("Opened"));
    ctx.onWidgetClose(() => console.log("Closed"));
  },
});
```
