# Chativa — Feature Versions

> Customizable, extensible, plug-and-play web component chat widget.
> Built on LitElement, TypeScript Strict, Zustand, Vitest, Vite.

---

## Implemented Features

### Core Architecture

| Feature | Details |
|---|---|
| **Hexagonal (Ports & Adapters) Architecture** | 4 layers: Domain → Application → Infrastructure ← UI. Strict dependency rule enforced. |
| **Monorepo** | `pnpm` workspace with packages: `core`, `ui`, `genui`, `connector-*`, `apps/sandbox` |
| **TypeScript Strict** | Full type exports from all packages |
| **Vitest Test Suite** | 224 passing tests (core + connector-dummy + genui). Coverage targets ≥ 80% |
| **Vite Build** | ESM + CJS dual output, `vite-plugin-dts` for type generation |
| **CI/CD** | GitHub Actions: auto-version from git tag, NPM publish |

---

### F1 — Chat Button (`<chat-bot-button>`)

- Floating action button with configurable position: `bottom-right | bottom-left | top-right | top-left`
- Size: `small | medium | large`
- Unread message badge
- Animated open/close icons
- Configurable color, icon, label via CSS variables or JSON theme
- `:focus-visible` outline for keyboard accessibility
- Icon SVGs marked `aria-hidden="true"`

---

### F2 — Connector System

| Connector | Package | Transport |
|---|---|---|
| `DummyConnector` | `@chativa/connector-dummy` | In-memory mock (dev/testing) |
| `WebSocketConnector` | `@chativa/connector-websocket` | Native browser WebSocket |
| `SignalRConnector` | `@chativa/connector-signalr` | Microsoft SignalR hub |
| `DirectLineConnector` | `@chativa/connector-directline` | Azure Bot Framework DirectLine v3 |
| `HttpConnector` | `@chativa/connector-http` | REST polling (`GET /messages`, `POST /messages`) — configurable interval, max errors |
| `SseConnector` | `@chativa/connector-sse` | EventSource receive + `POST` send; named events: `message`, `connected`, `typing` |

**IConnector optional capabilities (feature-detected at runtime):**
- `sendFile?(file, metadata?)` — file upload
- `loadHistory?(cursor?)` → `HistoryResult` — history pagination
- `onMessageStatus?(cb)` — delivery/read receipts
- `onTyping?(cb)` — typing indicator
- `sendFeedback?(id, "like"|"dislike")` — message feedback
- `onGenUIChunk?(cb)` — generative UI streaming
- `receiveComponentEvent?(streamId, eventType, payload)` — GenUI component events
- `addSentToHistory?: boolean` — control whether sent messages appear locally (false for DirectLine)

---

### F3 — Message Types

#### Built-in Types

| type | Component | Data Shape |
|---|---|---|
| `text` | `DefaultTextMessage` | `{ text: string }` — Markdown via `marked`, avatar, status ticks |
| `image` | `ImageMessage` | `{ src, alt?, caption? }` |
| `card` | `CardMessage` | `{ title, subtitle?, image?, buttons?: MessageAction[] }` |
| `buttons` | `ButtonsMessage` | `{ buttons: MessageAction[] }` |
| `quick-reply` | `QuickReplyMessage` | `{ actions: MessageAction[] }` |
| `carousel` | `CarouselMessage` | `{ cards: { title, image?, actions? }[] }` |
| `file` | `FileMessage` | `{ name, size?, url?, type? }` |
| `video` | `VideoMessage` | `{ src, poster?, caption? }` |
| `genui` | `GenUIMessage` | `{ streamId: string }` — streaming GenUI renderer |

#### Custom Types (F3b)

```ts
MessageTypeRegistry.register("product-card", ProductCardMessage);
```
Any LitElement implementing `IMessageRenderer` can be registered for any message type string.

---

### F4 — Extension System

- `install(context: ExtensionContext)` / `uninstall?()`
- `onBeforeSend?(msg) → msg | null` — transform or block outgoing messages
- `onAfterReceive?(msg) → msg | null` — transform or block incoming messages
- `onWidgetOpen?()` / `onWidgetClose?()` — widget lifecycle hooks
- `context.registerCommand(cmd)` — register slash commands from within extension

---

### F5 — i18n

- `i18next`-based runtime language detection
- Default languages: **English (`en`)**, **Turkish (`tr`)**
- `I18nMixin` (from `@chativa/core`) — reactive `this.t()` in all LitElement components
- `ChativaElement` base class: `extends I18nMixin(LitElement)`, all UI + GenUI components use it
- Extension-contributed translation namespaces supported
- Lazy `t()` resolution in slash commands and GenUI components

---

### F6 — Generative UI Streaming (GenUI)

**Chunk types streamed by connector:**

```ts
type AIChunk =
  | { type: "text";  content: string; id: string }
  | { type: "ui";    component: string; props: Record<string, unknown>; id: string }
  | { type: "event"; name: string; payload: unknown; id: string; target?: string }
```

**Built-in GenUI components (`@chativa/genui`):**

| Tag | Component | Description |
|---|---|---|
| `genui-text` | `GenUITextBlock` | Markdown text fragment |
| `genui-card` | `GenUICard` | Card with title/image/buttons; emits `chat-action` |
| `genui-form` | `GenUIForm` | Form fields; emits `form_submit` |
| `genui-alert` | `GenUIAlert` | Contextual alert/notice |
| `genui-quick-replies` | `GenUIQuickReplies` | Chip-style quick replies; emits `chat-action` |
| `genui-list` | `GenUIList` | Ordered/unordered list |
| `genui-table` | `GenUITable` | Data table |
| `genui-rating` | `GenUIRating` | Star rating; emits `rating_submit` |
| `genui-progress` | `GenUIProgress` | Progress bar |
| `genui-date-picker` | `GenUIDatePicker` | Native date picker; emits `date_selected` |
| `genui-chart` | `GenUIChart` | Bar/line/pie chart — SVG, zero deps |
| `genui-steps` | `GenUISteps` | Step-by-step progress indicator |
| `genui-image-gallery` | `GenUIImageGallery` | Image grid with lightbox |
| `genui-typewriter` | `GenUITypewriter` | Character-by-character typewriter animation |

Component events route back to connector via `ChatEngine.receiveComponentEvent()`.

---

### F7 — File Upload

- File button shown in `ChatInput` when connector implements `sendFile?()`
- File queue: preview files before sending (not immediate)
- Public `ChatInput.addFiles(files)` API
- Drag-and-drop overlay in `ChatWidget` (widget-level, depth counter handles child elements)
- i18n: `input.dropHere`, `input.dropHereSubtitle`, `input.attachFile`, `input.removeFile`
- ARIA: file buttons use i18n labels

---

### F8 — Message History & Pagination

- Scroll-to-top triggers `ChatEngine.loadHistory()`
- `ChatStore` tracks: `hasMoreHistory`, `isLoadingHistory`, `historyCursor`
- `MessageStore.prependMessages()` inserts older messages without duplicates
- `HistoryResult`: `{ messages: IncomingMessage[], hasMore: boolean, cursor?: string }`

---

### F9 — Message Status (Delivery & Read Receipts)

- User messages start in `"sending"` (optimistic update)
- Connector pushes `"sent"` → single tick
- Connector pushes `"read"` → double tick
- Shown in `DefaultTextMessage` when `theme.showMessageStatus === true`
- `StoredMessage.status?: "sending" | "sent" | "read"`

---

### F10 — Slash Commands

- `SlashCommandRegistry`: `register()`, `execute()`, `list()`
- Built-in: `/clear` — clears message list
- Autocomplete dropdown in `ChatInput` when user types `/`
- Commands registerable from application code or extensions
- Lazy i18n `description()` and `usage()` functions

---

### F11 — Auto-Reconnect

- Exponential backoff: 2s → 4s → 6s, max 3 attempts
- `ChatStore.reconnectAttempt` tracks current attempt for UI
- Reconnect banner shown in `ChatMessageList`
- Status → `"error"` when max attempts reached; resets on `ChatEngine.init()`

---

### F12 — Feedback (Like / Dislike)

- `DefaultTextMessage` renders like/dislike buttons on bot messages
- Routes to `connector.sendFeedback?(messageId, "like"|"dislike")`
- ARIA: `aria-pressed` + `aria-label` on feedback buttons

---

### F13 — Typing Indicator

- Connector calls `onTyping` callback
- Animated typing bubble shown in `ChatMessageList`
- `role="status" aria-label` for screen readers

---

### F14 — Emoji Picker

- `EmojiPicker` component opens on button click in `ChatInput`
- ARIA: `aria-haspopup + aria-expanded + aria-controls="emoji-popup"`

---

### F15 — Message Search

- `ChatStore.searchQuery` / `setSearchQuery()` / `clearSearch()`
- `ChatMessageList.displayMessages` filters by query client-side
- `ChatHeader` has search toggle (magnifying glass icon)
- Controlled via `theme.enableSearch?: boolean` (default `true`)
- Search result count shown via `role="status" aria-live="polite"`
- i18n: `header.search.*`, `messageList.search*`
- `SandboxControls` has "Search On/Off" toggle under Features

---

### F16 — ThemeBuilder

```ts
ThemeBuilder.create()
  .setPrimary("#4f46e5")
  .setAvatar({ bot: "https://...", showBot: true })
  .showMessageStatus(true)
  .build();
```

- Fluent builder API; exported from `@chativa/core`
- `packages/core/src/domain/value-objects/ThemeBuilder.ts`

---

### F17 — EventBus

- Typed events via `EventBusPayloadMap`
- `on(event, handler)`, `off(event, handler)`, `emit(event, payload)`, `clear()`
- `ChatEngine` emits 6 event types
- `ChatStore` emits: `widget_opened`, `widget_closed`, `search_query_changed`
- `packages/core/src/application/EventBus.ts`

---

### F18 — ARIA / Accessibility (WCAG 2.1 AA)

| Component | ARIA implementation |
|---|---|
| `ChatWidget` | `role="dialog" aria-modal="true"`, focus trap (shadow DOM recursive), ESC to close, focus restore |
| `ChatMessageList` | Spinner `role="status"`, typing bubble `role="status" aria-label`, search bar `role="status" aria-live="polite"`, reconnect banner `role="status"` |
| `ChatInput` | `textarea` with `aria-label + aria-autocomplete + aria-expanded + aria-controls`, slash popup `role="listbox"`, slash items `role="option" aria-selected` |
| `DefaultTextMessage` | `role="article" aria-label="{sender}: {text}"`, feedback btns `aria-pressed`, status SVGs `aria-hidden="true"` |
| `ChatBotButton` | `:focus-visible { outline }`, icon SVGs `aria-hidden="true"` |

---

### F19 — Chat Window Modes

`ThemeConfig.windowMode?: "popup" | "side-panel" | "fullscreen" | "inline"`

| Mode | Behavior |
|---|---|
| `popup` (default) | Floating card near the launcher button. Draggable, positioned by `theme.position`. |
| `side-panel` | Full-height drawer docked to the viewport edge (`right: 0` or `left: 0` based on `position`). Slide-in animation. |
| `fullscreen` | Covers the entire viewport. Equivalent to the existing `isFullscreen` toggle but controlled via theme. |
| `inline` | `position: static` — embeds the widget inside its parent container. No floating, no drag. |

**Implementation:**
- `WindowMode` type exported from `@chativa/core`
- `ChatWidget._positionStyle` returns appropriate CSS per mode
- Drag disabled for all modes except `popup`
- Mobile media query (`≤480px`) skips `inline-mode`
- `side-panel`: `slideInFromRight` / `slideInFromLeft` animations based on `position` alignment
- Sandbox "Window Mode" toggle: **Popup · Side · Full · Inline** — lives in `AppearanceSection`

---

### F20 — Sandbox Collapsible Sections

The sandbox panel is refactored into focused, accordion-style section components.

**File structure:**
```
apps/sandbox/src/sandbox/
├── SandboxControls.ts             (~115 lines) — panel shell only
├── sandboxShared.ts               — shared Lit CSS + injectMessage() + triggerGenUI()
└── sections/
    ├── AppearanceSection.ts       — Position · Color · Button Size · Edge Margin · Window Mode
    ├── FeaturesSection.ts         — Search toggle · Language switcher
    ├── MessagesSection.ts         — Message type demo buttons (starts collapsed)
    ├── GenUISection.ts            — GenUI demo buttons (starts collapsed)
    └── ActionsSection.ts          — Chat status · Open/Close · Fullscreen · Reset
```

- Each section is an independent `@customElement` with its own `_open` accordion state
- Chevron animates on open/close
- `sandboxShared.ts` provides shared `sectionStyles` (CSSResult) + helper functions

---

### F21 — Multi-Conversation & Agent Panel

**Popup multi-conversation mode (`theme.enableMultiConversation`):**
- `ThemeConfig.enableMultiConversation?: boolean` (default `false`)
- When enabled, a `←` back arrow button appears at the **top-left of the chat header**
- Clicking it slides in a `<conversation-list>` view (fills the popup); selecting a conversation returns to chat
- Sandbox "Features" panel has a **Multi-Conversation On/Off** toggle

**Agent Panel (`<agent-panel>`):**
- Standalone `@customElement("agent-panel")` for support/agent desk UIs
- Two-column layout: sidebar (`<conversation-list>`) + chat area (`<chat-header>` + `<chat-message-list>` + `<chat-input>`)
- Attributes: `connector` (default `"dummy"`) and `sidebar-width` (default `"260px"`)
- Accessible at `/agent-panel.html` — linked from the sandbox panel as "Agent Panel Demo →"

**New domain / application layer:**
- `Conversation` entity: `{ id, title, contact?, avatar?, lastMessage?, lastMessageAt?, unreadCount?, status }`
- `ConversationStore` (Zustand): CRUD, `activeConversationId`, snapshot message cache
- `MultiConversationEngine`: wraps a single `ChatEngine`; snapshot-based message switching; optional `IConnector` methods

**New IConnector optional methods:**
- `listConversations?()` → `Conversation[]`
- `createConversation?(title?, metadata?)` → `Conversation`
- `switchConversation?(id)` → `void`
- `closeConversation?(id)` → `void`
- `onConversationUpdate?(cb)` — push updates from backend

**DummyConnector:**
- Ships 3 demo conversations (Alice Johnson, Bob Martinez, Carol Smith)
- Injects a greeting message on first visit to each conversation
- `name` option is now configurable (default `"dummy"`) for multi-instance use (`"dummy-agent"` for the agent panel demo)

---

## Roadmap — Future Features

### Near-term

| ID | Feature | Description |
|---|---|---|
| **R1** | **Dark Mode / Theme Presets** | `theme.mode: "light" \| "dark" \| "system"`. Auto-detect via `prefers-color-scheme`. Ship 3-4 preset themes (minimal, corporate, bubbly). |
| **R2** | **RTL Language Support** | `theme.dir: "ltr" \| "rtl"`. CSS logical properties throughout. Hebrew/Arabic language packs. |
| **R3** | **Message Threading / Replies** | Click a message to reply inline. Thread indicator shows quoted message. `StoredMessage.replyTo?: string`. |
| **R4** | **Message Reactions** | Emoji reaction bar on hover/long-press. `connector.sendReaction?(id, emoji)`. Aggregated reaction counts displayed. |
| **R5** | **Voice Message Recording** | Record audio via `MediaRecorder`, playback inline. `connector.sendFile()` used for upload. Waveform visualization. |
| **R6** | **Server-side Message Search** | `connector.searchMessages?(query, cursor?)` optional method. Results highlighted in `ChatMessageList`. |
| **R7** | **Conversation Export** | Download chat as `.txt`, `.json`, or `.pdf`. Extension hook: `onExport?(messages)`. |
| **R8** | **Persistent Local Cache** | `localStorage`/`IndexedDB` message cache per conversation ID. Hydrate on reconnect, no flash of empty state. |
| **R8b** | **Message Pinning** | Pin important messages to the top of the chat window. `connector.pinMessage?(id)` optional. Pinned messages shown in a collapsible strip. |
| **R8c** | **Inline Link Preview** | Auto-fetch Open Graph metadata for pasted URLs. Renders title + image + description card below the message. |
| **R8d** | **Read Position Indicator** | "Jump to last read" button when user scrolls up. `MessageStore` tracks last-seen message ID per session. |
| **R8f** | **Message Copy Button** | One-click copy on hover for any text message. Copies plain text (strips Markdown). Toast confirmation. |
| **R8g** | **Command Palette (`Ctrl+K`)** | Fuzzy-search across slash commands, recent messages, and quick actions. Keyboard-navigable overlay. |

---

### Framework Wrapper Packages

| ID | Feature | Description |
|---|---|---|
| **R9** | **`@chativa/react`** | React wrapper for `<ChatWidget>` and `<ChatBotButton>` with typed props and ref forwarding. |
| **R10** | **`@chativa/vue`** | Vue 3 wrapper component with Composition API support. |
| **R11** | **`@chativa/angular`** | Angular element wrapper with `NgModule` and `standalone component` support. |

---

### New Connectors

| ID | Feature | Description |
|---|---|---|
| **R12** | **`connector-openai`** | OpenAI Responses API / SSE streaming; streams tokens as `genui-typewriter` chunks. |
| **R13** | **`connector-langchain`** | LangChain agent streaming via LangServe SSE endpoint. |
| **R14** | **`connector-firebase`** | Firestore real-time listener for messages; Firebase Storage for file upload. |
| **R15** | **`connector-mqtt`** | MQTT.js broker connector for IoT/edge chat scenarios. |
| **R15b** | **`connector-twilio`** | Twilio Conversations API; supports SMS and WhatsApp Business channels. |
| **R15c** | **`connector-telegram`** | Telegram Bot API via long-polling or webhook proxy. |
| **R15d** | **`connector-slack`** | Slack Web API + Events API; post messages to channels or DMs. |
| **R15e** | **`connector-matrix`** | Matrix/Element protocol via `matrix-js-sdk`; federated open messaging. |
| **R15f** | **`connector-grpc`** | gRPC server streaming connector for high-throughput / low-latency backends. |

---

### GenUI Extensions

| ID | Feature | Description |
|---|---|---|
| **R16** | **`genui-map`** | Interactive map using Leaflet. Drop-in for location-based bot responses. |
| **R17** | **`genui-code`** | Syntax-highlighted code block with copy button. Uses highlight.js or Shiki. |
| **R18** | **`genui-video-player`** | Embedded responsive video player with captions. |
| **R19** | **`genui-poll`** | Single/multi-choice poll widget; emits `poll_answer`. |
| **R20** | **`genui-pdf-viewer`** | Inline PDF viewer using `pdf.js`. |
| **R21** | **`genui-kanban`** | Drag-and-drop Kanban board streamed inline. |
| **R22** | **`genui-signature`** | Canvas-based signature pad; emits `signature_complete` with base64. |
| **R22b** | **`genui-countdown`** | Countdown timer with configurable end date; emits `timer_expired`. |
| **R22c** | **`genui-payment`** | Stripe Elements embed for inline payment collection; emits `payment_complete`. |
| **R22d** | **`genui-calendar`** | Appointment/date range scheduler; emits `slot_selected`. |
| **R22e** | **`genui-audio-player`** | Audio file playback with waveform visualization. |
| **R22f** | **`genui-flowchart`** | Mermaid.js diagram render — flowcharts, sequence diagrams, ER diagrams. |
| **R22g** | **`genui-diff-viewer`** | Side-by-side or unified code diff view. |

---

### Enterprise / Platform Features

| ID | Feature | Description |
|---|---|---|
| **R23** | **Analytics Extension** | Built-in analytics extension: page impressions, message sent/received, session duration. Adapters for Google Analytics, Mixpanel, Segment. |
| **R24** | **A/B Testing Support** | Extension hook to vary theme/connector based on experiment group. |
| **R25** | **Multi-Bot / Multi-Connector** | Route messages to different connectors by topic or user selection. |
| **R26** | **Bot Persona Customization** | Named personas with avatar, name, default greeting. Switch persona mid-session. |
| **R27** | **Push Notifications** | Service Worker + Web Push API integration. Badge on page title when widget is closed. |
| **R28** | **End-to-End Encryption** | Client-side message encryption (Web Crypto API). Key exchange via connector handshake. |
| **R29** | **Plugin Marketplace** | Registry of community extensions/connectors. Install by name: `npx chativa add my-plugin`. |
| **R30** | **Admin Dashboard** | Optional companion dashboard showing live sessions, message analytics, bot health. |
| **R30b** | **Bot → Human Handoff** | `connector.requestHandoff?()` triggers transfer to live agent. UI shows "Connected to agent" banner. Queue position indicator. |
| **R30c** | **Session Summary (AI)** | After conversation ends, AI generates a short summary. Shown to user and optionally sent to backend via `connector.submitSummary?()`. |
| **R30d** | **Sentiment Indicator** | Real-time sentiment analysis on user messages (positive / neutral / negative badge). Connector-side or client-side via ONNX/WASM model. |
| **R30e** | **Suggested Replies** | Bot can stream a `suggested_replies` chunk; chips appear above input. Clicking sends as user message. |
| **R30f** | **Token-by-Token Streaming (non-GenUI)** | Connector streams raw text tokens for fast perceived response. `ChatEngine` appends to last bot message without a full GenUI stream. |
| **R30g** | **Auth Token Refresh Hook** | `connector.onTokenExpired?(refresh: () => Promise<string>)` — automatic token re-injection without reconnect. |
| **R30h** | **Client-side Rate Limiting** | `theme.rateLimitMs?: number` — debounce send button; show cooldown countdown. Prevents spam. |
| **R30i** | **XSS Sanitization Layer** | Mandatory DOMPurify pass on all incoming `text` message HTML before render. Configurable allowed-tag list. |
| **R30j** | **CSP-Compatible Build** | No `eval`, no inline styles injected at runtime. Ships a `Content-Security-Policy` example header. Nonce support for Lit styles. |

---

### Developer Experience

| ID | Feature | Description |
|---|---|---|
| **R31** | **Storybook Integration** | Storybook stories for all UI and GenUI components with interactive controls. |
| **R32** | **CLI Scaffold Tool** | `npx create-chativa-connector my-connector` — full project scaffold. |
| **R33** | **Devtools Extension** | Browser devtools panel showing connector state, message pipeline, event bus log. |
| **R34** | **Visual Theme Editor** | Drag-and-drop web-based theme builder that exports `ThemeConfig` JSON. |
| **R35** | **Test Harness Package** | `@chativa/testing` — utilities for testing connectors, extensions, and message components with pre-built mocks. |
| **R36** | **SSR / Hydration Support** | Server-render initial HTML shell for the widget; hydrate client-side on load. |
| **R37** | **Mobile PWA App** | Standalone Progressive Web App shell using `ChatbotMixin`, offline support via Service Worker. |
| **R37b** | **Playwright E2E Test Suite** | Full browser integration tests: open widget, send message, check response, file upload, history scroll. |
| **R37c** | **Visual Regression Tests** | Chromatic / Percy snapshot comparison for all UI components on every PR. |
| **R37d** | **axe-core Accessibility Audit** | Automated WCAG 2.1 AA audit in CI via `axe-playwright`. Blocks merge on new violations. |
| **R37e** | **Connector Mock Recorder/Playback** | Record a real connector session to JSON fixture; replay deterministically in tests. |
| **R37f** | **Hot Reload for Sandbox Connectors** | HMR support in `apps/sandbox` for connector code — no full page reload needed during connector development. |
| **R37g** | **OpenAPI/AsyncAPI Schema Validation** | Optional schema file per connector. `ChatEngine` validates outgoing/incoming message shapes at runtime in dev mode. |
| **R37h** | **Web Worker Message Pipeline** | Move `ChatEngine` message processing off the main thread via `SharedWorker`. UI stays responsive under heavy message load. |
| **R37i** | **More Language Packs** | Community-contributed translations: German (`de`), French (`fr`), Spanish (`es`), Arabic (`ar`), Japanese (`ja`), Chinese (`zh`), Korean (`ko`). |

---

> See `PRD.md` for full product requirements and architecture details.
> See `AGENTS.md` for AI agent coding guidelines and conventions.
