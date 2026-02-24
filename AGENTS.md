# AGENTS.md — Chativa

Guidelines for AI agents (Claude, Copilot, Cursor, etc.) contributing to this codebase.

---

## Project Summary

Chativa is a **Ports & Adapters (Hexagonal) architecture** chat widget library built as a **pnpm monorepo** with:

- **LitElement** — Web Components framework
- **Zustand (vanilla)** — state management
- **i18next** — internationalization
- **Vitest** — testing
- **TypeScript strict mode**
- **@shoelace-style/shoelace** — UI primitives
- **@lit-labs/virtualizer** — virtual scrolling

Read [PRD.md](./PRD.md) for full product context before making changes.

---

## Monorepo Structure

```
packages/
├── core/               @chativa/core     — Domain + Application layers
├── ui/                 @chativa/ui       — LitElement chat widget
├── genui/              @chativa/genui    — Generative UI streaming
├── connector-dummy/    @chativa/connector-dummy
├── connector-websocket/ @chativa/connector-websocket
├── connector-signalr/  @chativa/connector-signalr
└── connector-directline/ @chativa/connector-directline
apps/
└── sandbox/            — Interactive demo app
```

Each package has its own `package.json`, `tsconfig.json`, and `src/` directory.
Tests live at `src/foo/__tests__/foo.test.ts` mirroring the source path.

---

## Architecture Rules (CRITICAL)

### Dependency Direction
```
UI → Application → Domain ← Infrastructure
```

1. **Domain layer** (`packages/core/src/domain/`) — ZERO external imports. Only TypeScript types/interfaces.
2. **Application layer** (`packages/core/src/application/`) — imports from `domain/` only. No UI, no infrastructure.
3. **Infrastructure layer** (connector packages) — imports from `@chativa/core` domain types only. Implements ports.
4. **UI layer** (`packages/ui/`, `packages/genui/`) — imports from `@chativa/core` application + domain. Never directly from connector packages.

**Violation example (WRONG):**
```ts
// packages/core/src/application/ChatEngine.ts — WRONG!
import { DummyConnector } from "@chativa/connector-dummy";
```

**Correct:**
```ts
// packages/core/src/application/ChatEngine.ts — CORRECT
import type { IConnector } from "../domain/IConnector";
```

---

## Layer Descriptions

### `packages/core/src/domain/` — Core Domain
- **Only TypeScript interfaces, types, and pure value object logic**
- No classes with side effects, no external library imports
- Key files:
  - `IConnector.ts` — required + optional connector methods
  - `IExtension.ts` — extension port + `ExtensionContext`
  - `ISlashCommand.ts` — slash command contract
  - `IMessageRenderer.ts` — message component contract
  - `Message.ts` — `IncomingMessage`, `OutgoingMessage`, `HistoryResult`, `MessageStatus`
  - `GenUI.ts` — `AIChunk`, `GenUIStreamState`, `GenUIChunkHandler`
  - `Theme.ts` — `ThemeConfig`, `AvatarConfig`, `mergeTheme()`, `themeToCSS()`

### `packages/core/src/application/` — Use Cases
- Orchestrates domain ports
- Contains: `ChatEngine`, `ConnectorRegistry`, `MessageTypeRegistry`, `ExtensionRegistry`, `SlashCommandRegistry`, `ChatStore`, `MessageStore`
- Uses dependency injection — receives `IConnector` instances, never instantiates them
- Registries are singletons with `.register()`, `.get()`, `.has()`, `.list()`, `.clear()` pattern

### `packages/core/src/ui/` — Shared UI Utilities
- `I18nMixin.ts` — LitElement mixin that subscribes to i18next and provides reactive `t(key)` method
- Re-exports `i18next` and `t` for convenience

### Connector packages (`packages/connector-*/`) — Adapters
- Each package = one connector class implementing `IConnector`
- Must handle `connect()` / `disconnect()` lifecycle
- Optional capabilities are feature-detected: `sendFile`, `loadHistory`, `onMessageStatus`, `sendFeedback`, `onGenUIChunk`, `receiveComponentEvent`

### `packages/ui/src/` — Chat Widget
- LitElement Web Components only
- State via `chatStore` and `messageStore` subscriptions
- All components extend `ChatbotMixin(LitElement)` which extends `I18nMixin(LitElement)`
- Virtual scrolling via `@lit-labs/virtualizer/virtualize.js`

### `packages/genui/src/` — Generative UI
- `GenUIMessage` — master container that assembles streaming `AIChunk` objects
- `GenUIRegistry` — maps component names to LitElement constructors
- Each built-in component self-registers on import
- All custom components receive `GenUIComponentAPI` injection at render time

---

## When Creating a New Connector

1. Create a new package directory `packages/connector-[name]/`
2. Add `package.json` (follow existing connector packages as template)
3. Create `src/[Name]Connector.ts` implementing `IConnector` from `@chativa/core`
4. Add tests in `src/__tests__/[Name]Connector.test.ts`
5. Export from `src/index.ts`
6. Document in the root `README.md` under the Connectors section

**Full template with optional capabilities:**
```ts
import type {
  IConnector,
  MessageHandler,
  OutgoingMessage,
  IncomingMessage,
  HistoryResult,
  GenUIChunkHandler,
} from "@chativa/core";

export class MyConnector implements IConnector {
  readonly name = "my-connector";
  readonly addSentToHistory = true;

  private messageHandler: MessageHandler | null = null;
  private statusCallback: ((id: string, status: "sent" | "read") => void) | null = null;
  private genUICallback: GenUIChunkHandler | null = null;

  async connect(): Promise<void> {
    // establish connection
  }

  async disconnect(): Promise<void> {
    // cleanup
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    // send to backend
  }

  onMessage(callback: MessageHandler): void {
    this.messageHandler = callback;
  }

  onConnect(callback: () => void): void { }
  onDisconnect(callback: (reason?: string) => void): void { }
  onTyping(callback: (isTyping: boolean) => void): void { }

  // Optional: file upload
  async sendFile(file: File, metadata?: Record<string, unknown>): Promise<void> { }

  // Optional: history pagination
  async loadHistory(cursor?: string): Promise<HistoryResult> {
    return { messages: [], hasMore: false };
  }

  // Optional: delivery/read receipts
  onMessageStatus(cb: (id: string, status: "sent" | "read") => void): void {
    this.statusCallback = cb;
  }

  // Optional: like/dislike feedback
  async sendFeedback(messageId: string, value: "like" | "dislike"): Promise<void> { }

  // Optional: GenUI streaming
  onGenUIChunk(callback: GenUIChunkHandler): void {
    this.genUICallback = callback;
  }

  receiveComponentEvent(streamId: string, eventType: string, payload: unknown): void { }
}
```

---

## When Creating a New Extension

1. Create the extension class anywhere (no required package — extensions are user-land)
2. Implement `IExtension` from `@chativa/core`
3. Install via `ExtensionRegistry.install(new MyExtension())`

**Template:**
```ts
import type { IExtension, ExtensionContext } from "@chativa/core";

export class MyExtension implements IExtension {
  readonly name = "my-extension";
  readonly version = "1.0.0";

  install(context: ExtensionContext): void {
    context.onAfterReceive((msg) => {
      // transform or react to incoming messages; return null to drop
      return msg;
    });

    context.onBeforeSend((msg) => {
      // transform or react to outgoing messages; return null to cancel
      return msg;
    });

    context.onWidgetOpen(() => { /* ... */ });

    // Register a slash command from within the extension
    context.registerCommand({
      name: "mycommand",
      description: "Does something cool",
      execute({ args }) { /* ... */ },
    });
  }

  uninstall(): void {
    // cleanup
  }
}
```

---

## When Creating a New Message Type Component

1. Create `packages/ui/src/chat-ui/messages/[Name]Message.ts`
2. Extend `ChatbotMixin(LitElement)`
3. Accept `messageData` property
4. Register with `MessageTypeRegistry` inside the component file (side-effect on import)
5. Re-export from `packages/ui/src/index.ts`
6. Add tests

**Template:**
```ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChatbotMixin } from "../../mixins/ChatbotMixin";
import { MessageTypeRegistry } from "@chativa/core";

@customElement("my-message")
export class MyMessage extends ChatbotMixin(LitElement) {
  @property({ type: Object }) messageData: Record<string, unknown> = {};

  static styles = css`
    :host { display: block; }
  `;

  render() {
    const { text } = this.messageData as { text: string };
    return html`<div class="my-message">${text}</div>`;
  }
}

// Self-register
MessageTypeRegistry.register("my-type", MyMessage);
```

---

## When Creating a New GenUI Component

1. Create `packages/genui/src/components/[Name].ts`
2. Extend `LitElement` (not ChatbotMixin — GenUI components are standalone)
3. Declare optional `GenUIComponentAPI` properties to receive injected methods
4. Self-register in `GenUIRegistry`
5. Add tests

**Template:**
```ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { GenUIRegistry } from "../registry/GenUIRegistry";
import type { GenUIComponentAPI } from "../types";

@customElement("my-genui-widget")
export class MyGenUIWidget extends LitElement {
  // Injected by GenUIMessage at render time
  sendEvent?: GenUIComponentAPI["sendEvent"];
  listenEvent?: GenUIComponentAPI["listenEvent"];
  tFn?: GenUIComponentAPI["tFn"];
  onLangChange?: GenUIComponentAPI["onLangChange"];

  @property({ type: String }) title = "";

  private _unsubLang?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsubLang = this.onLangChange?.(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubLang?.();
  }

  static styles = css`
    :host { display: block; }
  `;

  private _handleAction() {
    this.sendEvent?.("widget_action", { title: this.title });
  }

  render() {
    const label = this.tFn?.("widget.submit", "Submit") ?? "Submit";
    return html`
      <div>
        <h3>${this.title}</h3>
        <button @click=${this._handleAction}>${label}</button>
      </div>
    `;
  }
}

// Self-register
GenUIRegistry.register("my-widget", MyGenUIWidget);
```

---

## Testing Requirements

**Every PR must include tests. No exceptions.**

- Test file location mirrors source: `src/foo/bar.ts` → `src/foo/__tests__/bar.test.ts`
- Run tests: `pnpm test`
- Run with coverage: `pnpm test:coverage`
- Coverage threshold: 80% for application layer
- Always call `.clear()` on registries in `beforeEach`

### Test Patterns

**Unit test (registry):**
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { ConnectorRegistry } from "../ConnectorRegistry";

describe("ConnectorRegistry", () => {
  beforeEach(() => ConnectorRegistry.clear());

  it("registers and retrieves a connector by name", () => {
    const mock = { name: "mock" } as any;
    ConnectorRegistry.register(mock);
    expect(ConnectorRegistry.get("mock")).toBe(mock);
  });
});
```

**Integration test (ChatEngine):**
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatEngine } from "../ChatEngine";
import { messageStore } from "../MessageStore";

describe("ChatEngine", () => {
  beforeEach(() => messageStore.getState().clear());

  it("routes incoming messages to message store", async () => {
    const onMessageCbs: Function[] = [];
    const connector = {
      name: "mock",
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendMessage: vi.fn(),
      onMessage: (cb: Function) => onMessageCbs.push(cb),
    } as any;

    const engine = new ChatEngine(connector);
    await engine.init();
    onMessageCbs[0]({ id: "1", type: "text", from: "bot", data: { text: "Hi" } });
    expect(messageStore.getState().messages).toHaveLength(1);
  });
});
```

---

## Code Style

- TypeScript strict mode — no `any` without justification comment
- Interfaces for all public contracts (prefix with `I`: `IConnector`, `IExtension`)
- Registries are singletons — use `Registry.get()` / `Registry.register()` pattern
- No `console.log` in production code — remove debug logs before committing
- Async methods that can fail should throw typed errors
- Use `import type` for type-only imports

---

## Commit Message Convention

```
feat(connector): add WebSocketConnector with reconnect support
fix(store): prevent duplicate message IDs in MessageStore
feat(genui): add GenUIRating component
test(engine): add ChatEngine integration tests
docs(prd): update connector interface spec
refactor(ui): extract ChatHeader into separate component
```

Format: `type(scope): description`
Types: `feat | fix | test | docs | refactor | chore | style`

---

## File Naming

| Type | Convention | Example |
|---|---|---|
| Interface/Port | PascalCase, `I` prefix | `IConnector.ts` |
| Class | PascalCase | `WebSocketConnector.ts` |
| Test file | Same name + `.test.ts` | `WebSocketConnector.test.ts` |
| Test folder | `__tests__/` next to source | `connectors/__tests__/` |
| Lit component | PascalCase | `ChatWidget.ts` |
| GenUI component | PascalCase | `GenUIForm.ts` |
| Store | PascalCase + `Store` suffix | `MessageStore.ts` |
| Registry | PascalCase + `Registry` suffix | `ConnectorRegistry.ts` |

---

## What NOT to Do

- Do NOT import infrastructure/connector packages in `packages/core` or `packages/ui`/`packages/genui`
- Do NOT use `document.querySelector` or DOM APIs in domain/application layers
- Do NOT add connector-specific logic to `ChatEngine`
- Do NOT skip tests when adding a new connector/extension/GenUI component
- Do NOT use `any` types in domain or application layers
- Do NOT put business logic in LitElement `render()` methods
- Do NOT use `console.log` — remove debug logs before committing
- Do NOT make `ChatStore` or `MessageStore` non-singleton without an explicit architectural decision (multi-session support is a planned future feature)
- Do NOT import `@lit-labs/virtualizer` with the bare package name — always use `@lit-labs/virtualizer/virtualize.js`
- Do NOT add named `tFn` as `translate` in GenUI components — `HTMLElement.translate` conflicts
