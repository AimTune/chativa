# PRD — Chativa

> Customizable, extensible, plug-and-play web component chat widget.

---

## 1. Vision

Chativa is an open-source chat widget library built on Web Components (LitElement). Developers embed a single script tag and get a fully functional, themeable chat button and window. They can swap backends (connectors), extend UI with custom message types, and write plugins (extensions) — all without touching core library code.

---

## 2. Goals

| # | Goal |
|---|------|
| G1 | Zero-config embed: one script + one HTML tag |
| G2 | Full visual customization via CSS variables and a JSON config object |
| G3 | Plug-and-play connectors (WebSocket, SignalR, DirectLine, custom) |
| G4 | Custom message type components (cards, images, carousels, etc.) |
| G5 | Extension API for hooks, middleware, analytics, etc. |
| G6 | Framework-agnostic (works in React, Vue, Angular, plain HTML) |
| G7 | Fully testable — unit + integration tests at every layer |

---

## 3. User Personas

### 3.1 Embedder Developer
Wants to drop a chat widget into an existing site with minimal config.

**Needs:**
- Single script include
- JSON-based theme config
- Works out of the box with a mock/dummy connector

### 3.2 Integration Developer
Wants to connect Chativa to their backend (custom API, SignalR hub, Azure Bot, etc.).

**Needs:**
- Well-defined `IConnector` interface
- TypeScript types exported
- Clear lifecycle (connect, send, receive, disconnect)

### 3.3 Extension Developer
Wants to add analytics, custom commands, message transformers, or rich UI components.

**Needs:**
- `IExtension` install/uninstall hooks
- Access to message pipeline
- Ability to register custom message renderers

---

## 4. Features

### 4.1 Customizable Chat Button (F1)

- Floating action button with configurable position: `bottom-right | bottom-left | top-right | top-left`
- Size: `small | medium | large`
- Color, icon, label — all configurable

**CSS Variables (runtime override):**
```css
--chativa-primary-color
--chativa-secondary-color
--chativa-background-color
--chativa-text-color
--chativa-border-color
--chativa-button-size
--chativa-border-radius
--chativa-font-family
--chativa-position-x        /* horizontal margin */
--chativa-position-y        /* vertical margin */
```

**JSON Config (programmatic):**
```json
{
  "theme": {
    "colors": {
      "primary": "#4f46e5",
      "secondary": "#6c757d",
      "background": "#ffffff",
      "text": "#212529",
      "border": "#dee2e6"
    },
    "position": "bottom-right",
    "positionMargin": "2",
    "size": "medium",
    "layout": {
      "width": "360px",
      "height": "520px",
      "maxWidth": "100%",
      "maxHeight": "100%"
    }
  }
}
```

### 4.2 Connector System — Port & Adapters (F2)

Each connector implements `IConnector` (the Port). Connectors are registered by name and selected at runtime.

**Built-in connectors:**
```
IConnector (Port / Interface)
├── DummyConnector        — local mock, no network, for dev/testing
├── WebSocketConnector    — native browser WebSocket
├── SignalRConnector      — @microsoft/signalr hub
└── DirectLineConnector   — Azure Bot Framework DirectLine v3
```

**Custom connector:**
```ts
class MyApiConnector implements IConnector {
  readonly name = "my-api";
  async connect() { ... }
  async disconnect() { ... }
  async sendMessage(msg: OutgoingMessage) { ... }
  onMessage(cb: MessageHandler) { ... }
}

ConnectorRegistry.register(new MyApiConnector());
// <chat-iva connector="my-api">
```

**IConnector interface contract:**
```ts
interface IConnector {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(message: OutgoingMessage): Promise<void>;
  onMessage(callback: MessageHandler): void;
  onConnect?(callback: () => void): void;
  onDisconnect?(callback: (reason?: string) => void): void;
  readonly addSentToHistory?: boolean;  // default true
}
```

### 4.3 Custom Message Types (F3)

Register a LitElement component for any message type:
```ts
MessageTypeRegistry.register("product-card", ProductCardMessage);
// Incoming { type: "product-card", data: {...} } → renders ProductCardMessage
```

All message components implement `IMessageRenderer`:
```ts
interface IMessageRenderer {
  messageData: IncomingMessage["data"];
}
```

### 4.4 Extensions (F4)

```ts
ExtensionRegistry.install(new AnalyticsExtension({ trackingId: "UA-..." }));
ExtensionRegistry.install(new CommandExtension({ prefix: "/" }));
```

Extension lifecycle:
- `install(context: ExtensionContext)` — called once on registration
- `uninstall()` — cleanup
- `onBeforeSend?(msg) → msg | null` — transform or block outgoing messages
- `onAfterReceive?(msg) → msg | null` — transform or block incoming messages
- `onWidgetOpen?()` / `onWidgetClose?()` — lifecycle hooks

### 4.5 i18n (F5)

- Runtime language detection via i18next
- Translation key namespaces extensible via extensions
- Default: English (en), Turkish (tr)

---

## 5. Architecture

### 5.1 Layered Hexagonal (Ports & Adapters)

```
┌──────────────────────────────────────────────────┐
│                    UI Layer                      │
│  ChatBotButton  ChatWidget  ChatMessageList      │
│               (LitElement Web Components)        │
└─────────────────────┬────────────────────────────┘
                      │ uses
┌─────────────────────▼────────────────────────────┐
│               Application Layer                  │
│  ChatEngine  ConnectorRegistry                   │
│  MessageTypeRegistry  ExtensionRegistry          │
│  ChatStore  MessageStore                         │
└──────┬───────────────────────────┬───────────────┘
       │ depends on                │ instantiates
┌──────▼──────────┐   ┌────────────▼───────────────┐
│  Domain Layer   │   │   Infrastructure Layer     │
│  IConnector     │   │   DummyConnector           │
│  IExtension     │   │   WebSocketConnector       │
│  IMessageRend.  │   │   SignalRConnector         │
│  Message        │   │   DirectLineConnector      │
│  Theme          │   │   [YourConnector]          │
└─────────────────┘   └────────────────────────────┘
```

**Dependency rule:** Inner layers never import from outer layers.

### 5.2 Directory Structure

```
src/
├── domain/                      # Pure types — zero external deps
│   ├── entities/
│   │   └── Message.ts           # IncomingMessage, OutgoingMessage
│   ├── ports/
│   │   ├── IConnector.ts        # Connector port (interface)
│   │   ├── IExtension.ts        # Extension port (interface)
│   │   └── IMessageRenderer.ts  # Message component contract
│   └── value-objects/
│       └── Theme.ts             # ThemeConfig type
├── application/                 # Orchestration — depends only on domain
│   ├── ChatEngine.ts
│   ├── registries/
│   │   ├── ConnectorRegistry.ts
│   │   ├── MessageTypeRegistry.ts
│   │   └── ExtensionRegistry.ts
│   └── stores/
│       ├── ChatStore.ts
│       └── MessageStore.ts
├── infrastructure/              # Concrete connector implementations
│   └── connectors/
│       ├── DummyConnector.ts
│       ├── WebSocketConnector.ts
│       ├── SignalRConnector.ts
│       └── DirectLineConnector.ts
├── ui/                          # LitElement components
│   ├── components/
│   │   ├── ChatWidget.ts
│   │   ├── ChatBotButton.ts
│   │   ├── ChatHeader.ts
│   │   ├── ChatInput.ts
│   │   ├── ChatMessageList.ts
│   │   └── messages/
│   │       └── DefaultTextMessage.ts
│   └── mixins/
│       └── ChatbotMixin.ts
└── i18n/
    ├── i18n.ts
    ├── en.json
    └── tr.json
```

---

## 6. Public API Surface

```ts
// HTML usage
<chat-bot-button></chat-bot-button>
<chat-iva connector="websocket"></chat-iva>

// Programmatic configuration
import { Chativa } from "chativa";

Chativa.configure({
  theme: { colors: { primary: "#4f46e5" } },
  connector: "websocket",
});

// Register connectors
import { ConnectorRegistry } from "chativa";
ConnectorRegistry.register(new WebSocketConnector({ url: "wss://..." }));

// Register custom message type
import { MessageTypeRegistry } from "chativa";
MessageTypeRegistry.register("card", CardMessageComponent);

// Register extension
import { ExtensionRegistry } from "chativa";
ExtensionRegistry.install(new AnalyticsExtension());
```

---

## 7. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Bundle size | < 50 KB gzipped (excl. connector deps) |
| First render | < 100ms |
| Zero framework deps | Works in plain HTML |
| TypeScript | Strict mode, full types exported |
| Test coverage | >= 80% domain + application layers |
| Browser support | Evergreen + Safari 16+ |

---

## 8. Testing Strategy

| Layer | Tool | Coverage target |
|---|---|---|
| Domain (types/interfaces) | Vitest | 100% (compile-time) |
| Application (engine, registries, stores) | Vitest | >= 90% |
| Infrastructure (connectors) | Vitest + mocks | >= 80% |
| UI (components) | Vitest + @open-wc/testing | >= 70% |

Tests run with: `npm test`
Coverage report: `npm run test:coverage`

---

## 9. Out of Scope (v1)

- Server-side rendering
- React/Vue/Angular wrapper packages (planned v2)
- File/media upload UI (can be built as extension)
- Native mobile apps
