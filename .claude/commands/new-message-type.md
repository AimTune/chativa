---
description: Scaffold a new chat message-type LitElement under packages/ui/src/chat-ui/.
argument-hint: <PascalCase name, e.g. ProductCard>
---

# New Message Type Component

Scaffold a new message-type LitElement that renders a custom payload in the chat stream.

Usage: `/new-message-type ProductCard`

> Built-in message types live in `packages/ui/src/chat-ui/` (e.g. `CardMessage.ts`, `ButtonsMessage.ts`, `ImageMessage.ts`). They extend `LitElement` directly (not `ChatbotMixin` — that mixin is reserved for the widget shell, not message bodies) and self-register on import via `MessageTypeRegistry.register(typeKey, Class)`.

---

Given the message type name `$ARGUMENTS` (PascalCase), the type key in messages will be `[lowercase]` (e.g. `ProductCard` → `"product-card"` is conventional, but check the existing pattern — `card`, `buttons`, `image`, `file`, `video`, `carousel`).

## Step 1 — Create the component

Create `packages/ui/src/chat-ui/$ARGUMENTS_Message.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { MessageTypeRegistry } from "@chativa/core";

/**
 * $ARGUMENTS message component.
 * Register a message of type "[type-key]" with:
 *   { /* shape of messageData here */ }
 */
@customElement("[kebab-name]-message")
export class $ARGUMENTS_Message extends LitElement {
  static override styles = css`
    :host { display: block; }
    .container {
      padding: 0.5rem;
      border: 1px solid var(--chativa-border-color, #dee2e6);
      border-radius: 0.5rem;
    }
  `;

  @property({ type: Object }) messageData: Record<string, unknown> = {};

  override render() {
    return html`
      <div class="container">
        <pre>${JSON.stringify(this.messageData, null, 2)}</pre>
      </div>
    `;
  }
}

MessageTypeRegistry.register(
  "[type-key]",
  $ARGUMENTS_Message as unknown as typeof HTMLElement,
);

export default $ARGUMENTS_Message;
```

If the component dispatches user actions (button clicks, form submits, etc.), follow the `chat-action` event pattern from `CardMessage.ts` / `ButtonsMessage.ts` (`bubbles: true`, `composed: true`).

## Step 2 — Tests

Create `packages/ui/src/chat-ui/__tests__/$ARGUMENTS_Message.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MessageTypeRegistry } from "@chativa/core";

// Importing the module triggers self-registration.
import "../$ARGUMENTS_Message";

describe("$ARGUMENTS_Message", () => {
  it("self-registers in MessageTypeRegistry", () => {
    expect(MessageTypeRegistry.has("[type-key]")).toBe(true);
  });

  it("resolves to a defined custom element constructor", () => {
    const Ctor = MessageTypeRegistry.resolve("[type-key]");
    expect(Ctor).toBeDefined();
  });
});
```

## Step 3 — Wire up in `packages/ui/src/index.ts`

Add the side-effect import alongside the others so the component registers when consumers import `@chativa/ui`:

```ts
import "./chat-ui/$ARGUMENTS_Message";
```

Add a named export only if the component is part of the public API:

```ts
export { $ARGUMENTS_Message } from "./chat-ui/$ARGUMENTS_Message";
```

## Step 4 — Verify

Run `pnpm --filter @chativa/ui typecheck` and `pnpm --filter @chativa/ui test`.
