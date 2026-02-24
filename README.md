# Chativa — Embeddable Web Component Chat Widget

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Built with LitElement](https://img.shields.io/badge/Built%20with-LitElement-324fff?logo=lit)](https://lit.dev/)
[![Tests](https://img.shields.io/badge/Tests-Vitest-6e9f18?logo=vitest)](https://vitest.dev/)

**Chativa** is an open-source, framework-agnostic chat widget built on [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) (LitElement). Drop a single `<script>` tag into any page — React, Vue, Angular, or plain HTML — and get a fully functional, themeable chat interface.

Connect to any backend via pluggable **connectors** (WebSocket, SignalR, Azure Bot DirectLine, or your own), render rich message types (cards, carousels, images, video), stream **Generative UI** components inline in the chat, and extend behavior with a middleware **extension** pipeline.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Connectors](#connectors)
- [Built-in Message Types](#built-in-message-types)
- [Custom Message Types](#custom-message-types)
- [Generative UI (GenUI)](#generative-ui-genui)
- [Extensions](#extensions)
- [Slash Commands](#slash-commands)
- [File Upload](#file-upload)
- [Message History](#message-history)
- [Message Status](#message-status)
- [Theming](#theming)
- [i18n](#i18n)
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
| **Built-in message types** | Text/Markdown, image, card, carousel, buttons, quick replies, file, video |
| **Custom message types** | Register any LitElement component for any message type |
| **Generative UI streaming** | Stream AI-generated components (forms, charts, cards) inline |
| **Extension API** | Middleware hooks for analytics, transformers, slash commands |
| **Slash commands** | Built-in `/clear` + register custom commands with autocomplete |
| **File upload** | Optional `sendFile()` support per connector |
| **Message history** | Cursor-based pagination with scroll-to-top loading |
| **Message status** | Sending → Sent → Read tick indicators |
| **Auto-reconnect** | Exponential backoff, configurable max attempts |
| **Full theming** | CSS variables + JSON config object + avatar support |
| **i18n ready** | Built-in English & Turkish; extensible via i18next |
| **Virtual scrolling** | Efficient rendering for large message histories |
| **TypeScript strict** | Full types exported, no `any` |
| **< 50 KB gzipped** | Lightweight core bundle |

---

## Quick Start

### 1. Install

```bash
pnpm add @chativa/ui @chativa/core
# also add a connector:
pnpm add @chativa/connector-dummy
```

### 2. Embed

```html
<script type="module" src="https://unpkg.com/@chativa/ui/dist/chativa.js"></script>

<chat-bot-button></chat-bot-button>
<chat-iva connector="dummy"></chat-iva>
```

### 3. Configure programmatically

```ts
import { ConnectorRegistry, chatStore } from "@chativa/core";
import { WebSocketConnector } from "@chativa/connector-websocket";

ConnectorRegistry.register(
  new WebSocketConnector({ url: "wss://your-server/chat" })
);

chatStore.getState().setConnector("websocket");
chatStore.getState().setTheme({
  colors: { primary: "#4f46e5" },
  position: "bottom-right",
});
```

---

## Configuration

### JSON Config (via `chatStore`)

```ts
import { chatStore } from "@chativa/core";

chatStore.getState().setTheme({
  colors: {
    primary: "#4f46e5",
    secondary: "#6c757d",
    background: "#ffffff",
    text: "#212529",
    border: "#dee2e6",
  },
  position: "bottom-right",     // bottom-right | bottom-left | top-right | top-left
  positionMargin: "2",
  size: "medium",               // small | medium | large
  layout: {
    width: "360px",
    height: "520px",
    maxWidth: "100%",
    maxHeight: "100%",
  },
  avatar: {
    bot: "https://example.com/bot-avatar.png",  // URL or omit for default SVG
    showBot: true,
    showUser: false,
  },
  showMessageStatus: true,      // show delivery/read ticks on user messages
  allowFullscreen: true,
});
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

| Package | Connector | Description |
|---|---|---|
| `@chativa/connector-dummy` | `DummyConnector` | Local mock — no network, great for dev/testing |
| `@chativa/connector-websocket` | `WebSocketConnector` | Native browser WebSocket |
| `@chativa/connector-signalr` | `SignalRConnector` | Microsoft SignalR hub |
| `@chativa/connector-directline` | `DirectLineConnector` | Azure Bot Framework DirectLine v3 |

### DummyConnector Options

```ts
import { DummyConnector } from "@chativa/connector-dummy";

const connector = new DummyConnector({
  replyDelay: 500,      // ms before auto-reply
  connectDelay: 2000,   // ms to simulate handshake
});

// Helpers for testing
connector.injectMessage({ id: "1", type: "text", from: "bot", data: { text: "Hello!" } });
connector.triggerGenUI("/genui-weather");
```

### WebSocketConnector Options

```ts
import { WebSocketConnector } from "@chativa/connector-websocket";

new WebSocketConnector({
  url: "wss://your-server/chat",
  protocols: ["v1"],
  reconnect: true,            // default true
  reconnectDelay: 2000,       // ms
  maxReconnectAttempts: 5,
});
```

### SignalRConnector Options

```ts
import { SignalRConnector } from "@chativa/connector-signalr";

new SignalRConnector({
  url: "https://your-server/hub",
  hubName: "chat",
  receiveMethod: "ReceiveMessage",
  sendMethod: "SendMessage",
  accessTokenFactory: () => localStorage.getItem("token") ?? "",
});
```

### Custom Connector

```ts
import type {
  IConnector,
  OutgoingMessage,
  MessageHandler,
  IncomingMessage,
  HistoryResult,
} from "@chativa/core";
import { ConnectorRegistry } from "@chativa/core";

class MyApiConnector implements IConnector {
  readonly name = "my-api";
  readonly addSentToHistory = true;

  private messageHandler: MessageHandler | null = null;

  async connect(): Promise<void> { /* open connection */ }
  async disconnect(): Promise<void> { /* close connection */ }
  async sendMessage(msg: OutgoingMessage): Promise<void> { /* send */ }
  onMessage(cb: MessageHandler): void { this.messageHandler = cb; }

  // Optional: file upload
  async sendFile(file: File, metadata?: Record<string, unknown>): Promise<void> { }

  // Optional: cursor-based history
  async loadHistory(cursor?: string): Promise<HistoryResult> {
    return { messages: [], hasMore: false };
  }

  // Optional: delivery/read callbacks
  onMessageStatus(cb: (id: string, status: "sent" | "read") => void): void { }

  // Optional: like/dislike feedback
  async sendFeedback(messageId: string, value: "like" | "dislike"): Promise<void> { }
}

ConnectorRegistry.register(new MyApiConnector());
```

```html
<chat-iva connector="my-api"></chat-iva>
```

---

## Built-in Message Types

Chativa ships with components for all common message types. When a connector delivers an incoming message with a matching `type`, the correct component renders automatically.

| Type | Component | Data Shape |
|---|---|---|
| `text` | `DefaultTextMessage` | `{ text: string }` — Markdown supported |
| `image` | `ImageMessage` | `{ src: string, alt?: string, caption?: string }` |
| `card` | `CardMessage` | `{ title: string, subtitle?: string, image?: string, buttons?: MessageAction[] }` |
| `buttons` | `ButtonsMessage` | `{ buttons: MessageAction[] }` |
| `quick-reply` | `QuickReplyMessage` | `{ actions: MessageAction[] }` |
| `carousel` | `CarouselMessage` | `{ cards: { title, image?, actions? }[] }` |
| `file` | `FileMessage` | `{ name: string, size?: number, url?: string, type?: string }` |
| `video` | `VideoMessage` | `{ src: string, poster?: string, caption?: string }` |
| `genui` | `GenUIMessage` | `{ streamId: string }` — see [Generative UI](#generative-ui-genui) |

`MessageAction` shape: `{ label: string, value?: string }`

All built-in types are automatically registered. You can override any with your own component via `MessageTypeRegistry`.

---

## Custom Message Types

Register any LitElement component to handle a custom message type:

```ts
import { MessageTypeRegistry } from "@chativa/core";
import { ProductCardMessage } from "./ProductCardMessage";

MessageTypeRegistry.register("product-card", ProductCardMessage);
```

When an incoming message with `{ type: "product-card", data: { ... } }` arrives, Chativa automatically renders `ProductCardMessage`. All message components implement `IMessageRenderer`:

```ts
interface IMessageRenderer {
  messageData: Record<string, unknown>;
}
```

---

## Generative UI (GenUI)

`@chativa/genui` lets connectors **stream UI components** inline inside chat messages. The bot can render forms, charts, progress bars, and any custom component — in real time, as data arrives.

### Built-in GenUI Components

| Name | Description | Key Props |
|---|---|---|
| `genui-text` | Markdown text block | `content: string` |
| `genui-card` | Card with title, description, actions | `title, description, actions[]` |
| `genui-form` | Dynamic form with validation | `fields[]` (text/email/number/date/checkbox/select) |
| `genui-alert` | Styled alert box | `message, variant: info\|success\|warning\|error` |
| `genui-quick-replies` | Quick reply chip buttons | `items[]` (label, value?, icon?) |
| `genui-list` | Scrollable item list | `items[]` (title, description?) |
| `genui-table` | Data table | `headers[], rows[][]` |
| `genui-rating` | Star rating | `value, max` |
| `genui-progress` | Progress bar | `value (0-100), variant` |

### Custom GenUI Component

Register any LitElement component as a streamable GenUI component:

```ts
import { GenUIRegistry } from "@chativa/genui";
import type { GenUIComponentAPI } from "@chativa/genui";

class WeatherWidget extends LitElement {
  // GenUIComponentAPI methods are injected by GenUIMessage
  sendEvent?: GenUIComponentAPI["sendEvent"];
  listenEvent?: GenUIComponentAPI["listenEvent"];
  tFn?: GenUIComponentAPI["tFn"];

  @property({ type: String }) city = "";
  @property({ type: Number }) temp = 0;

  render() {
    return html`<div>${this.city}: ${this.temp}°C</div>`;
  }
}

GenUIRegistry.register("weather", WeatherWidget);
```

### Streaming from a Connector

The connector emits `AIChunk` objects which the engine assembles into a streaming message:

```ts
import type { AIChunk, GenUIChunkHandler } from "@chativa/core";

// In your connector:
onGenUIChunk(callback: GenUIChunkHandler): void {
  this.genUICallback = callback;
}

// Emit chunks as they arrive from the server:
this.genUICallback({ type: "text", content: "Current weather:", id: "chunk-1" });
this.genUICallback({ type: "ui", component: "weather", props: { city: "Istanbul", temp: 22 }, id: "chunk-2" });
this.genUICallback({ type: "event", name: "stream_end", payload: {}, id: "chunk-3" });
```

### Streaming from Fetch (SSE)

```ts
import { streamFromFetch } from "@chativa/genui";

await streamFromFetch("/api/chat/stream", (chunk) => {
  // chunk: AIChunk — route to your connector's genUICallback
});
```

### GenUIComponentAPI

All registered GenUI components receive these methods injected at render time:

```ts
interface GenUIComponentAPI {
  sendEvent(type: string, payload: unknown): void;      // send to connector
  listenEvent(type: string, cb: (payload: unknown) => void): void;
  tFn(key: string, fallback?: string): string;          // i18n translation
  onLangChange(cb: () => void): () => void;             // subscribe to locale change
}
```

---

## Extensions

Extensions hook into the message pipeline. Use them for analytics, transformers, logging, or registering custom slash commands.

```ts
import { ExtensionRegistry } from "@chativa/core";

ExtensionRegistry.install(new AnalyticsExtension({ trackingId: "UA-..." }));
```

### Extension Lifecycle

```ts
interface IExtension {
  readonly name: string;
  readonly version: string;
  install(context: ExtensionContext): void;
  uninstall?(): void;
  onBeforeSend?(msg: OutgoingMessage): OutgoingMessage | null;
  onAfterReceive?(msg: IncomingMessage): IncomingMessage | null;
  onWidgetOpen?(): void;
  onWidgetClose?(): void;
}
```

Return `null` from `onBeforeSend` or `onAfterReceive` to block the message entirely.

`ExtensionContext` also exposes `registerCommand(cmd)` for registering slash commands from within an extension.

---

## Slash Commands

Chativa has a built-in `/clear` command. Register your own:

```ts
import { registerCommand } from "@chativa/ui";

registerCommand({
  name: "help",
  description: () => t("commands.help.description"),   // lazy i18n supported
  usage: () => t("commands.help.usage"),
  execute({ args }) {
    // args: string[] — words after the command name
    console.log("Help requested:", args);
  },
});
```

Users type `/` in the chat input to see an autocomplete list of all registered commands.

---

## File Upload

Connectors that implement `sendFile()` automatically get a file upload button in the chat input.

```ts
class MyConnector implements IConnector {
  async sendFile(file: File, metadata?: Record<string, unknown>): Promise<void> {
    const form = new FormData();
    form.append("file", file);
    await fetch("/upload", { method: "POST", body: form });
  }
}
```

---

## Message History

Connectors that implement `loadHistory()` enable scroll-to-top pagination. When the user scrolls to the top of the message list, older messages are loaded automatically.

```ts
class MyConnector implements IConnector {
  async loadHistory(cursor?: string): Promise<HistoryResult> {
    const res = await fetch(`/history?before=${cursor ?? ""}`);
    const data = await res.json();
    return {
      messages: data.messages,   // IncomingMessage[]
      hasMore: data.hasMore,
      cursor: data.nextCursor,
    };
  }
}
```

---

## Message Status

Connectors that implement `onMessageStatus()` can push delivery/read updates for user messages. Enable the UI tick indicators via the theme:

```ts
chatStore.getState().setTheme({ showMessageStatus: true });
```

```ts
class MyConnector implements IConnector {
  onMessageStatus(cb: (id: string, status: "sent" | "read") => void): void {
    this.statusCallback = cb;
  }
}
```

Status flow: `sending` (optimistic, immediately on send) → `sent` (server ack) → `read` (bot/user read receipt).

---

## Theming

| Property | Values |
|---|---|
| `position` | `bottom-right` \| `bottom-left` \| `top-right` \| `top-left` |
| `size` | `small` \| `medium` \| `large` |
| `positionMargin` | `"1"` – `"5"` (space scale) |
| `allowFullscreen` | `boolean` |
| `showMessageStatus` | `boolean` |
| `avatar.bot` | URL string or omit for default SVG |
| `avatar.user` | URL string or omit for default SVG |
| `avatar.showBot` | `boolean` |
| `avatar.showUser` | `boolean` |

All theme values are deeply merged — override only what you need via `mergeTheme(base, overrides)`.

---

## i18n

Chativa uses [i18next](https://www.i18next.com/) internally. The widget ships with English (`en`) and Turkish (`tr`) translations.

```ts
import { i18n } from "@chativa/ui";

// Switch language at runtime
i18n.changeLanguage("tr");

// Add your own translations (e.g. from an extension)
i18n.addResourceBundle("de", "translation", {
  "input.placeholder": "Nachricht schreiben...",
});
```

The `I18nMixin` (from `@chativa/core`) provides reactive `t(key)` calls — all components auto-update when the language changes.

---

## Architecture

Chativa follows a **Hexagonal (Ports & Adapters)** architecture. The dependency rule is strictly enforced: inner layers never import from outer layers.

```
┌─────────────────────────────────────────────────────────┐
│                       UI Layer                          │
│  @chativa/ui  ·  @chativa/genui                         │
│  ChatWidget · ChatBotButton · ChatInput                 │
│  ChatMessageList · DefaultTextMessage · …               │
│  GenUIMessage · GenUIForm · GenUICard · …               │
└──────────────────────────┬──────────────────────────────┘
                           │ uses
┌──────────────────────────▼──────────────────────────────┐
│                  Application Layer                      │
│  @chativa/core (application/)                           │
│  ChatEngine · ConnectorRegistry · MessageTypeRegistry   │
│  ExtensionRegistry · SlashCommandRegistry               │
│  ChatStore · MessageStore                               │
└────────┬──────────────────────────────┬─────────────────┘
         │ depends on                   │ instantiates
┌────────▼──────────┐   ┌──────────────▼─────────────────┐
│   Domain Layer    │   │      Infrastructure Layer      │
│  @chativa/core    │   │  @chativa/connector-dummy      │
│  IConnector       │   │  @chativa/connector-websocket  │
│  IExtension       │   │  @chativa/connector-signalr    │
│  ISlashCommand    │   │  @chativa/connector-directline │
│  IMessageRenderer │   │  [your-connector]              │
│  Message · Theme  │   └────────────────────────────────┘
│  GenUI types      │
└───────────────────┘
```

**Dependency rule:** `UI → Application → Domain ← Infrastructure`

---

## Directory Structure

```
packages/
├── core/                        # Domain + Application layers (@chativa/core)
│   └── src/
│       ├── domain/
│       │   ├── IConnector.ts    # Connector port (interface + optional methods)
│       │   ├── IExtension.ts    # Extension port
│       │   ├── ISlashCommand.ts # Slash command contract
│       │   ├── IMessageRenderer.ts
│       │   ├── Message.ts       # IncomingMessage, OutgoingMessage, HistoryResult
│       │   ├── GenUI.ts         # AIChunk, GenUIStreamState types
│       │   └── Theme.ts         # ThemeConfig, mergeTheme, themeToCSS
│       ├── application/
│       │   ├── ChatEngine.ts
│       │   ├── ConnectorRegistry.ts
│       │   ├── MessageTypeRegistry.ts
│       │   ├── ExtensionRegistry.ts
│       │   ├── SlashCommandRegistry.ts
│       │   ├── ChatStore.ts
│       │   └── MessageStore.ts
│       └── ui/
│           └── I18nMixin.ts     # Shared i18n mixin for LitElement
│
├── ui/                          # LitElement chat widget (@chativa/ui)
│   └── src/
│       ├── chat-ui/
│       │   ├── ChatWidget.ts
│       │   ├── ChatBotButton.ts
│       │   ├── ChatHeader.ts
│       │   ├── ChatInput.ts
│       │   ├── ChatMessageList.ts
│       │   ├── EmojiPicker.ts
│       │   └── messages/
│       │       ├── DefaultTextMessage.ts
│       │       ├── ImageMessage.ts
│       │       ├── CardMessage.ts
│       │       ├── ButtonsMessage.ts
│       │       ├── QuickReplyMessage.ts
│       │       ├── CarouselMessage.ts
│       │       ├── FileMessage.ts
│       │       └── VideoMessage.ts
│       └── mixins/
│           └── ChatbotMixin.ts
│
├── genui/                       # Generative UI streaming (@chativa/genui)
│   └── src/
│       ├── components/
│       │   ├── GenUIMessage.ts
│       │   ├── GenUITextBlock.ts
│       │   ├── GenUICard.ts
│       │   ├── GenUIForm.ts
│       │   ├── GenUIAlert.ts
│       │   ├── GenUIQuickReplies.ts
│       │   ├── GenUIList.ts
│       │   ├── GenUITable.ts
│       │   ├── GenUIRating.ts
│       │   └── GenUIProgress.ts
│       ├── registry/
│       │   └── GenUIRegistry.ts
│       └── types.ts
│
├── connector-dummy/             # Dev/test mock connector
├── connector-websocket/         # Native WebSocket connector
├── connector-signalr/           # Microsoft SignalR connector
└── connector-directline/        # Azure Bot Framework DirectLine connector

apps/
└── sandbox/                     # Interactive demo application
    └── src/
        ├── main.ts
        ├── components/
        │   ├── WeatherWidget.ts
        │   └── AIForm.ts
        └── sandbox/
            └── SandboxControls.ts
```

---

## Development

```bash
# Install dependencies
pnpm install

# Start sandbox (dev server)
pnpm dev

# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type check all packages
pnpm typecheck

# Build all packages
pnpm build
```

### Tech Stack

- [LitElement 3](https://lit.dev/) — Web Component base
- [TypeScript](https://www.typescriptlang.org/) — Strict mode
- [Zustand](https://zustand-demo.pmnd.rs/) — Vanilla state management
- [i18next](https://www.i18next.com/) — Internationalization
- [@shoelace-style/shoelace](https://shoelace.style/) — UI primitives
- [@lit-labs/virtualizer](https://github.com/lit/lit/tree/main/packages/labs/virtualizer) — Virtual scrolling
- [Vite 7](https://vite.dev/) — Build tool
- [Vitest 4](https://vitest.dev/) — Unit & integration testing

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (follow [conventional commits](https://www.conventionalcommits.org/))
4. Open a pull request

See [AGENTS.md](AGENTS.md) for coding conventions and architecture rules.

---

## License

[MIT](LICENSE) — © [Hamza Agar](https://github.com/AimTune)
