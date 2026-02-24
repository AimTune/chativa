# PRD — Chativa

> Customizable, extensible, plug-and-play web component chat widget.

---

## 1. Vision

Chativa is an open-source chat widget library built on Web Components (LitElement). Developers embed a single script tag and get a fully functional, themeable chat button and window. They can swap backends (connectors), stream AI-generated UI components inline (GenUI), extend UI with custom message types, and write plugins (extensions) — all without touching core library code.

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
| G8 | Generative UI streaming — connectors can stream LitElement components inline |

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
- Optional capabilities: file upload, history pagination, message status, GenUI streaming

### 3.3 Extension Developer
Wants to add analytics, custom commands, message transformers, or rich UI components.

**Needs:**
- `IExtension` install/uninstall hooks
- Access to message pipeline
- Ability to register custom message renderers and slash commands

### 3.4 AI/GenUI Developer
Wants to build bots that stream rich interactive components (forms, cards, charts) inline.

**Needs:**
- `onGenUIChunk()` connector API for streaming `AIChunk` objects
- `GenUIRegistry` for registering custom components
- `GenUIComponentAPI` injection (`sendEvent`, `listenEvent`, `tFn`)
- SSE/fetch stream helper

---

## 4. Features

### 4.1 Customizable Chat Button (F1)

- Floating action button (`<chat-bot-button>`) with configurable position: `bottom-right | bottom-left | top-right | top-left`
- Size: `small | medium | large`
- Animated icons, slot support for custom content
- Unread message badge
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

**JSON Config (programmatic via `chatStore.getState().setTheme()`):**
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
    },
    "avatar": {
      "bot": "https://example.com/bot.png",
      "showBot": true,
      "showUser": false
    },
    "showMessageStatus": true,
    "allowFullscreen": true
  }
}
```

### 4.2 Connector System — Port & Adapters (F2)

Each connector implements `IConnector` (the Port). Connectors are registered by name via `ConnectorRegistry` and selected at runtime.

**Built-in connectors:**
```
IConnector (Port / Interface)
├── DummyConnector        — local mock, no network, for dev/testing
├── WebSocketConnector    — native browser WebSocket
├── SignalRConnector      — @microsoft/signalr hub
└── DirectLineConnector   — Azure Bot Framework DirectLine v3
```

**IConnector interface contract:**
```ts
interface IConnector {
  // Required
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(message: OutgoingMessage): Promise<void>;
  onMessage(callback: MessageHandler): void;

  // Optional — presence is feature-detected at runtime
  onConnect?(callback: () => void): void;
  onDisconnect?(callback: (reason?: string) => void): void;
  onTyping?(callback: (isTyping: boolean) => void): void;
  sendFile?(file: File, metadata?: Record<string, unknown>): Promise<void>;
  loadHistory?(cursor?: string): Promise<HistoryResult>;
  onMessageStatus?(callback: (id: string, status: "sent" | "read") => void): void;
  sendFeedback?(messageId: string, value: "like" | "dislike"): Promise<void>;
  onGenUIChunk?(callback: GenUIChunkHandler): void;
  receiveComponentEvent?(streamId: string, eventType: string, payload: unknown): void;

  readonly addSentToHistory?: boolean;  // default true; false for DirectLine (bot echoes)
}
```

### 4.3 Built-in Message Types (F3a)

The following message types are registered automatically by `@chativa/ui`:

| type | Component | Data Shape |
|---|---|---|
| `text` | `DefaultTextMessage` | `{ text: string }` |
| `image` | `ImageMessage` | `{ src, alt?, caption? }` |
| `card` | `CardMessage` | `{ title, subtitle?, image?, buttons?: MessageAction[] }` |
| `buttons` | `ButtonsMessage` | `{ buttons: MessageAction[] }` |
| `quick-reply` | `QuickReplyMessage` | `{ actions: MessageAction[] }` |
| `carousel` | `CarouselMessage` | `{ cards: { title, image?, actions? }[] }` |
| `file` | `FileMessage` | `{ name, size?, url?, type? }` |
| `video` | `VideoMessage` | `{ src, poster?, caption? }` |
| `genui` | `GenUIMessage` | `{ streamId: string }` |

`DefaultTextMessage` renders Markdown via `marked`, supports avatars and message status ticks.

### 4.4 Custom Message Types (F3b)

Register a LitElement component for any message type:
```ts
MessageTypeRegistry.register("product-card", ProductCardMessage);
// Incoming { type: "product-card", data: {...} } → renders ProductCardMessage
```

All message components implement `IMessageRenderer`:
```ts
interface IMessageRenderer {
  messageData: Record<string, unknown>;
}
```

### 4.5 Extensions (F4)

```ts
ExtensionRegistry.install(new AnalyticsExtension({ trackingId: "UA-..." }));
```

Extension lifecycle:
- `install(context: ExtensionContext)` — called once on registration
- `uninstall?()` — cleanup
- `onBeforeSend?(msg) → msg | null` — transform or block outgoing messages
- `onAfterReceive?(msg) → msg | null` — transform or block incoming messages
- `onWidgetOpen?()` / `onWidgetClose?()` — lifecycle hooks
- `context.registerCommand(cmd)` — register a slash command from within the extension

### 4.6 i18n (F5)

- Runtime language detection via i18next
- Translation key namespaces extensible via extensions
- Default: English (`en`), Turkish (`tr`)
- `I18nMixin` (from `@chativa/core`) provides reactive `t(key)` method in all LitElement components
- Lazy translation resolution in slash commands and GenUI components

### 4.7 Generative UI Streaming (F6)

The connector streams `AIChunk` objects; `ChatEngine` assembles them into a live `GenUIStreamState` attached to a synthetic `genui` message.

```ts
type AIChunk =
  | { type: "text"; content: string; id: string }       // markdown text fragment
  | { type: "ui"; component: string; props: Record<string, unknown>; id: string }  // component
  | { type: "event"; name: string; payload: unknown; id: string; target?: string }; // control event
```

`GenUIMessage` renders the accumulated chunks, resolving each `ui` chunk via `GenUIRegistry`. Custom components are injected with `GenUIComponentAPI` at mount time.

Built-in GenUI components (registered in `@chativa/genui`):

| Name | Component | Event emitted |
|---|---|---|
| `genui-text` | `GenUITextBlock` | — |
| `genui-card` | `GenUICard` | `chat-action` |
| `genui-form` | `GenUIForm` | `form_submit` |
| `genui-alert` | `GenUIAlert` | — |
| `genui-quick-replies` | `GenUIQuickReplies` | `chat-action` |
| `genui-list` | `GenUIList` | — |
| `genui-table` | `GenUITable` | — |
| `genui-rating` | `GenUIRating` | `rating_submit` |
| `genui-progress` | `GenUIProgress` | — |

Component events route back to the connector via `ChatEngine.receiveComponentEvent()`.

### 4.8 File Upload (F7)

- Connectors that implement `sendFile?()` automatically expose a file button in `ChatInput`
- Capability detected at runtime via `typeof connector.sendFile === "function"`
- Metadata object passed alongside the `File` for custom tagging

### 4.9 Message History & Pagination (F8)

- Connectors that implement `loadHistory?()` enable scroll-to-top pagination
- `ChatStore` tracks `hasMoreHistory`, `isLoadingHistory`, `historyCursor`
- `ChatEngine.loadHistory()` fetches older messages and prepends them via `MessageStore.prependMessages()`
- `HistoryResult` shape: `{ messages: IncomingMessage[], hasMore: boolean, cursor?: string }`

### 4.10 Message Status — Delivery & Read Receipts (F9)

- User messages start in `"sending"` state (optimistic)
- Connector pushes `"sent"` via `onMessageStatus` callback → tick indicator
- Connector pushes `"read"` → double tick indicator
- Status ticks shown in `DefaultTextMessage` when `theme.showMessageStatus === true`
- `StoredMessage.status?: "sending" | "sent" | "read"`

### 4.11 Slash Commands (F10)

- `SlashCommandRegistry` manages all registered commands
- Built-in: `/clear` — clears the message list
- `ChatInput` shows autocomplete dropdown when user types `/`
- Register commands from application code or from within an extension

```ts
registerCommand({
  name: "help",
  description: () => t("commands.help.description"),  // lazy i18n
  usage: () => t("commands.help.usage"),
  execute({ args }) { ... },
});
```

### 4.12 Auto-Reconnect (F11)

- `ChatEngine` monitors connector disconnect events
- Exponential backoff: 2 s → 4 s → 6 s, max 3 attempts
- `ChatStore.reconnectAttempt` tracks current attempt for UI display
- On max attempts reached, status moves to `"error"` and reconnect stops
- Can be reset by calling `ChatEngine.init()` again

---

## 5. Architecture

### 5.1 Monorepo Package Layout

```
packages/
├── core                    # Domain + Application layers
├── ui                      # LitElement chat widget components
├── genui                   # Generative UI streaming
├── connector-dummy         # Mock connector (dev/testing)
├── connector-websocket     # Native WebSocket
├── connector-signalr       # Microsoft SignalR
└── connector-directline    # Azure Bot Framework DirectLine
apps/
└── sandbox                 # Interactive demo app
```

### 5.2 Layered Hexagonal (Ports & Adapters)

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
│  ChatStore (Zustand) · MessageStore (Zustand)           │
└────────┬──────────────────────────────┬─────────────────┘
         │ depends on                   │ instantiates
┌────────▼──────────┐   ┌──────────────▼─────────────────┐
│   Domain Layer    │   │      Infrastructure Layer      │
│  @chativa/core    │   │  @chativa/connector-dummy      │
│  (domain/)        │   │  @chativa/connector-websocket  │
│  IConnector       │   │  @chativa/connector-signalr    │
│  IExtension       │   │  @chativa/connector-directline │
│  ISlashCommand    │   │  [your-connector]              │
│  IMessageRenderer │   └────────────────────────────────┘
│  Message · Theme  │
│  GenUI types      │
└───────────────────┘
```

**Dependency rule:** Inner layers never import from outer layers.
`UI → Application → Domain ← Infrastructure`

### 5.3 Directory Structure

```
packages/core/src/
├── domain/
│   ├── IConnector.ts        # Connector port (required + optional methods)
│   ├── IExtension.ts        # Extension port + ExtensionContext
│   ├── ISlashCommand.ts     # Slash command contract
│   ├── IMessageRenderer.ts  # Message component contract
│   ├── Message.ts           # IncomingMessage, OutgoingMessage, HistoryResult, MessageStatus
│   ├── GenUI.ts             # AIChunk, GenUIStreamState, GenUIChunkHandler
│   └── Theme.ts             # ThemeConfig, AvatarConfig, mergeTheme, themeToCSS
├── application/
│   ├── ChatEngine.ts
│   ├── ConnectorRegistry.ts
│   ├── MessageTypeRegistry.ts
│   ├── ExtensionRegistry.ts
│   ├── SlashCommandRegistry.ts
│   ├── ChatStore.ts         # isOpened, connectorStatus, theme, history state, …
│   └── MessageStore.ts      # messages[], deduplication
└── ui/
    └── I18nMixin.ts         # Shared reactive i18n mixin for LitElement

packages/ui/src/
├── chat-ui/
│   ├── ChatWidget.ts
│   ├── ChatBotButton.ts
│   ├── ChatHeader.ts
│   ├── ChatInput.ts         # slash command autocomplete, file upload, emoji
│   ├── ChatMessageList.ts   # virtual scroll, history pagination
│   ├── EmojiPicker.ts
│   └── messages/
│       ├── DefaultTextMessage.ts  # markdown, avatar, status ticks
│       ├── ImageMessage.ts
│       ├── CardMessage.ts
│       ├── ButtonsMessage.ts
│       ├── QuickReplyMessage.ts
│       ├── CarouselMessage.ts
│       ├── FileMessage.ts
│       └── VideoMessage.ts
└── mixins/
    └── ChatbotMixin.ts

packages/genui/src/
├── components/
│   ├── GenUIMessage.ts      # master chunk renderer + event router
│   ├── GenUITextBlock.ts
│   ├── GenUICard.ts
│   ├── GenUIForm.ts
│   ├── GenUIAlert.ts
│   ├── GenUIQuickReplies.ts
│   ├── GenUIList.ts
│   ├── GenUITable.ts
│   ├── GenUIRating.ts
│   └── GenUIProgress.ts
├── registry/
│   └── GenUIRegistry.ts
└── types.ts
```

---

## 6. Public API Surface

```ts
// HTML
<chat-bot-button></chat-bot-button>
<chat-iva connector="websocket"></chat-iva>

// State
import { chatStore, messageStore } from "@chativa/core";
chatStore.getState().setTheme({ colors: { primary: "#4f46e5" } });
chatStore.getState().setConnector("websocket");

// Registries
import { ConnectorRegistry, MessageTypeRegistry, ExtensionRegistry } from "@chativa/core";
ConnectorRegistry.register(new WebSocketConnector({ url: "wss://..." }));
MessageTypeRegistry.register("product-card", ProductCardMessage);
ExtensionRegistry.install(new AnalyticsExtension());

// Slash commands
import { registerCommand } from "@chativa/ui";
registerCommand({ name: "help", description: "Show help", execute() { ... } });

// GenUI
import { GenUIRegistry } from "@chativa/genui";
GenUIRegistry.register("my-widget", MyWidget);
```

---

## 7. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Bundle size | < 50 KB gzipped (core + ui, excl. connector deps) |
| First render | < 100 ms |
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
| UI (components) | Vitest + jsdom | >= 70% |

Test command: `pnpm test`
Coverage report: `pnpm test:coverage`

---

## 9. Out of Scope (v1)

- Server-side rendering
- React/Vue/Angular wrapper packages (planned v2)
- Native mobile apps
