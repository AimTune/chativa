# Chativa — Embeddable Web Component Chat Widget

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Built with LitElement](https://img.shields.io/badge/Built%20with-LitElement-324fff?logo=lit)](https://lit.dev/)
[![Tests](https://img.shields.io/badge/Tests-Vitest-6e9f18?logo=vitest)](https://vitest.dev/)

**Chativa** is an open-source, framework-agnostic chat widget built on [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) (LitElement). Drop a single `<script>` tag into any page — React, Vue, Angular, or plain HTML — and get a fully functional, themeable chat interface.

Connect to any backend via pluggable **connectors** (WebSocket, SignalR, Azure Bot DirectLine, or your own), render custom message types (cards, carousels, images), and extend behavior with a middleware **extension** pipeline.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Connectors](#connectors)
- [Custom Message Types](#custom-message-types)
- [Extensions](#extensions)
- [Theming](#theming)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| Feature | Description |
|---|---|
| **Zero-config embed** | One `<script>` tag + one HTML element |
| **Framework-agnostic** | Works in React, Vue, Angular, or plain HTML |
| **Pluggable connectors** | WebSocket, SignalR, Azure DirectLine, or custom |
| **Custom message types** | Register LitElement components for any message type |
| **Extension API** | Middleware hooks for analytics, commands, transformers |
| **Full theming** | CSS variables + JSON config object |
| **i18n ready** | Built-in English & Turkish; extensible via i18next |
| **TypeScript strict** | Full types exported, no `any` |
| **< 50 KB gzipped** | Lightweight core bundle |

---

## Quick Start

### 1. Install

```bash
npm install chativa
# or
pnpm add chativa
```

### 2. Embed

```html
<script type="module" src="https://unpkg.com/chativa/dist/chativa.js"></script>

<chat-bot-button></chat-bot-button>
<chat-iva connector="dummy"></chat-iva>
```

### 3. Configure programmatically

```ts
import { Chativa, ConnectorRegistry, WebSocketConnector } from "chativa";

ConnectorRegistry.register(
  new WebSocketConnector({ url: "wss://your-server/chat" })
);

Chativa.configure({
  connector: "websocket",
  theme: {
    colors: { primary: "#4f46e5" },
    position: "bottom-right",
  },
});
```

---

## Configuration

Pass a JSON config object or CSS variables to customize the widget at runtime.

### JSON Config

```json
{
  "connector": "websocket",
  "theme": {
    "colors": {
      "primary": "#4f46e5",
      "secondary": "#6c757d",
      "background": "#ffffff",
      "text": "#212529",
      "border": "#dee2e6"
    },
    "position": "bottom-right",
    "size": "medium",
    "layout": {
      "width": "360px",
      "height": "520px"
    }
  }
}
```

### CSS Variables

Override any visual property at runtime:

```css
chat-iva {
  --chativa-primary-color: #4f46e5;
  --chativa-background-color: #ffffff;
  --chativa-text-color: #212529;
  --chativa-border-radius: 12px;
  --chativa-font-family: "Inter", sans-serif;
  --chativa-button-size: 56px;
  --chativa-position-x: 24px;
  --chativa-position-y: 24px;
}
```

---

## Connectors

Chativa uses a **Ports & Adapters** pattern. Every connector implements `IConnector` and is registered by name.

### Built-in Connectors

| Connector | Description |
|---|---|
| `DummyConnector` | Local mock — no network, great for dev/testing |
| `WebSocketConnector` | Native browser WebSocket |
| `SignalRConnector` | Microsoft SignalR hub |
| `DirectLineConnector` | Azure Bot Framework DirectLine v3 |

### Custom Connector

```ts
import { IConnector, OutgoingMessage, MessageHandler } from "chativa";
import { ConnectorRegistry } from "chativa";

class MyApiConnector implements IConnector {
  readonly name = "my-api";

  async connect(): Promise<void> { /* open connection */ }
  async disconnect(): Promise<void> { /* close connection */ }
  async sendMessage(msg: OutgoingMessage): Promise<void> { /* send */ }
  onMessage(cb: MessageHandler): void { /* subscribe to incoming */ }
}

ConnectorRegistry.register(new MyApiConnector());
```

```html
<chat-iva connector="my-api"></chat-iva>
```

---

## Custom Message Types

Register any LitElement component to handle a message type:

```ts
import { MessageTypeRegistry } from "chativa";
import { ProductCardMessage } from "./ProductCardMessage";

MessageTypeRegistry.register("product-card", ProductCardMessage);
```

When an incoming message with `{ type: "product-card", data: { ... } }` arrives, Chativa automatically renders your component. All message components implement `IMessageRenderer`:

```ts
interface IMessageRenderer {
  messageData: IncomingMessage["data"];
}
```

---

## Extensions

Extensions hook into the message pipeline before send and after receive. Use them for analytics, command parsing, message transformation, or logging.

```ts
import { ExtensionRegistry } from "chativa";

ExtensionRegistry.install(new AnalyticsExtension({ trackingId: "UA-..." }));
ExtensionRegistry.install(new CommandExtension({ prefix: "/" }));
```

### Extension Lifecycle

```ts
interface IExtension {
  readonly name: string;
  install(context: ExtensionContext): void;
  uninstall(): void;
  onBeforeSend?(msg: OutgoingMessage): OutgoingMessage | null;
  onAfterReceive?(msg: IncomingMessage): IncomingMessage | null;
  onWidgetOpen?(): void;
  onWidgetClose?(): void;
}
```

Return `null` from `onBeforeSend` or `onAfterReceive` to block the message entirely.

---

## Theming

Button positions: `bottom-right` | `bottom-left` | `top-right` | `top-left`

Button sizes: `small` | `medium` | `large`

All theme values are deeply merged — override only what you need.

---

## Architecture

Chativa follows a **Hexagonal (Ports & Adapters)** architecture with a strict one-way dependency rule: inner layers never import from outer layers.

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

**Dependency rule:** `UI → Application → Domain ← Infrastructure`

---

## Directory Structure

```
src/
├── domain/                      # Pure types — zero external deps
│   ├── entities/Message.ts      # IncomingMessage, OutgoingMessage
│   ├── ports/
│   │   ├── IConnector.ts
│   │   ├── IExtension.ts
│   │   └── IMessageRenderer.ts
│   └── value-objects/Theme.ts
├── application/                 # Orchestration
│   ├── ChatEngine.ts
│   ├── registries/
│   │   ├── ConnectorRegistry.ts
│   │   ├── MessageTypeRegistry.ts
│   │   └── ExtensionRegistry.ts
│   └── stores/
│       ├── ChatStore.ts
│       └── MessageStore.ts
├── infrastructure/              # Connector implementations
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
│   │   └── messages/DefaultTextMessage.ts
│   └── mixins/ChatbotMixin.ts
└── i18n/
    ├── i18n.ts
    ├── en.json
    └── tr.json
```

---

## Development

```bash
# Install dependencies
pnpm install

# Start sandbox (dev server)
pnpm dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type check
pnpm typecheck

# Build all packages
pnpm build
```

### Tech Stack

- [LitElement 3](https://lit.dev/) — Web Component base
- [TypeScript](https://www.typescriptlang.org/) — Strict mode
- [Zustand](https://zustand-demo.pmnd.rs/) — Vanilla state management
- [i18next](https://www.i18next.com/) — Internationalization
- [Vite 7](https://vite.dev/) — Build tool
- [Vitest 4](https://vitest.dev/) — Unit & integration testing
- [@shoelace-style/shoelace](https://shoelace.style/) — UI primitives

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Open a pull request

See [AGENTS.md](AGENTS.md) for coding conventions and architecture rules.

---

## License

[MIT](LICENSE) — © [Hamza Agar](https://github.com/AimTune)
