# AGENTS.md — Chativa

Guidelines for AI agents (Claude, Copilot, Cursor, etc.) contributing to this codebase.

---

## Project Summary

Chativa is a **Ports & Adapters (Hexagonal) architecture** chat widget library built with:
- **LitElement** — Web Components framework
- **Zustand (vanilla)** — state management
- **i18next** — internationalization
- **Vitest** — testing
- **TypeScript strict mode**

Read [PRD.md](./PRD.md) for full product context before making changes.

---

## Architecture Rules (CRITICAL)

### Dependency Direction
```
UI → Application → Domain ← Infrastructure
```

1. **Domain layer** (`src/domain/`) — ZERO external imports. Only TypeScript types/interfaces.
2. **Application layer** (`src/application/`) — imports from `domain/` only. No UI, no infrastructure.
3. **Infrastructure layer** (`src/infrastructure/`) — imports from `domain/` only. Implements ports.
4. **UI layer** (`src/ui/`) — imports from `application/` and `domain/`. Never from `infrastructure/` directly.

**Violation example (WRONG):**
```ts
// src/application/ChatEngine.ts — WRONG!
import { DummyConnector } from "../infrastructure/connectors/DummyConnector";
```

**Correct:**
```ts
// src/application/ChatEngine.ts — CORRECT
import type { IConnector } from "../domain/ports/IConnector";
```

---

## Layer Descriptions

### `src/domain/` — Core Domain
- **Only TypeScript interfaces, types, and value object shapes**
- No classes with logic, no external library imports
- Files: `IConnector.ts`, `IExtension.ts`, `IMessageRenderer.ts`, `Message.ts`, `Theme.ts`

### `src/application/` — Use Cases
- Orchestrates domain ports
- Contains: `ChatEngine`, `ConnectorRegistry`, `MessageTypeRegistry`, `ExtensionRegistry`, `ChatStore`, `MessageStore`
- Uses dependency injection — receives `IConnector` instances, never instantiates them

### `src/infrastructure/` — Adapters
- Concrete implementations of `IConnector`
- Each file = one connector class
- Must implement all required `IConnector` methods
- Must handle `connect()` / `disconnect()` lifecycle

### `src/ui/` — Presentation
- LitElement Web Components only
- State via `ChatStore` and `MessageStore` subscriptions
- All components extend `ChatbotMixin(LitElement)`

---

## When Creating a New Connector

1. Create `src/infrastructure/connectors/[Name]Connector.ts`
2. Implement `IConnector` from `src/domain/ports/IConnector.ts`
3. Add tests in `src/infrastructure/connectors/__tests__/[Name]Connector.test.ts`
4. Register it in `src/index.ts` exports
5. Document it in `README.md`

**Template:**
```ts
import type { IConnector, MessageHandler, OutgoingMessage } from "../../domain/ports/IConnector";

export class MyConnector implements IConnector {
  readonly name = "my-connector";
  readonly addSentToHistory = true;

  private messageHandler: MessageHandler | null = null;

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
}
```

---

## When Creating a New Extension

1. Create `src/infrastructure/extensions/[Name]Extension.ts`
2. Implement `IExtension` from `src/domain/ports/IExtension.ts`
3. Add tests in `src/infrastructure/extensions/__tests__/[Name]Extension.test.ts`

**Template:**
```ts
import type { IExtension, ExtensionContext } from "../../domain/ports/IExtension";

export class MyExtension implements IExtension {
  readonly name = "my-extension";
  readonly version = "1.0.0";

  install(context: ExtensionContext): void {
    context.onMessageReceived((msg) => {
      // transform or react to messages
      return msg;
    });
  }

  uninstall(): void {
    // cleanup
  }
}
```

---

## When Creating a New Message Type Component

1. Create `src/ui/components/messages/[Name]Message.ts`
2. Extend `LitElement`, use `ChatbotMixin`
3. Accept `messageData` property matching `IncomingMessage["data"]`
4. Register with `MessageTypeRegistry` in the component file
5. Add tests

**Template:**
```ts
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChatbotMixin } from "../../mixins/ChatbotMixin";

@customElement("my-message")
export class MyMessage extends ChatbotMixin(LitElement) {
  @property({ type: Object }) messageData: any = {};

  render() {
    return html`<div>${this.messageData.text}</div>`;
  }
}
```

---

## Testing Requirements

**Every PR must include tests. No exceptions.**

- Test file location mirrors source: `src/foo/bar.ts` → `src/foo/__tests__/bar.test.ts`
- Run tests: `npm test`
- Run with coverage: `npm run test:coverage`
- Coverage threshold: 80% for application layer

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
import { describe, it, expect, vi } from "vitest";
import { ChatEngine } from "../ChatEngine";
import { createMockConnector } from "../../test-utils/createMockConnector";

describe("ChatEngine", () => {
  it("routes incoming messages to message store", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector, messageStore, messageTypeRegistry);
    engine.init();
    // trigger message
    connector.simulateIncoming({ id: "1", type: "text", data: { text: "Hi" } });
    expect(messageStore.getState().messages).toHaveLength(1);
  });
});
```

---

## Code Style

- TypeScript strict mode — no `any` without justification comment
- Interfaces for all public contracts (prefix with `I`: `IConnector`, `IExtension`)
- Registries are singletons — use `Registry.get()` / `Registry.register()` pattern
- No `console.log` in production code — use a logger abstraction or remove
- Async methods that can fail should throw typed errors

---

## Commit Message Convention

```
feat(connector): add WebSocketConnector with reconnect support
fix(store): prevent duplicate message IDs in MessageStore
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
| Store | PascalCase + `Store` suffix | `MessageStore.ts` |
| Registry | PascalCase + `Registry` suffix | `ConnectorRegistry.ts` |

---

## What NOT to Do

- Do NOT import infrastructure in application or domain layers
- Do NOT use `document.querySelector` or DOM APIs in domain/application layers
- Do NOT add connector-specific logic to `ChatEngine`
- Do NOT skip tests when adding a new connector/extension
- Do NOT use `any` types in domain or application layers
- Do NOT put business logic in LitElement `render()` methods
- Do NOT use `console.log` — remove debug logs before committing
