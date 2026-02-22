# New Message Type Component

Scaffold a new custom message type component.

Usage: `/new-message-type ProductCard`

---

Given the message type name `$ARGUMENTS`, do the following:

## Step 1 — Create the component

Create `src/ui/components/messages/$ARGUMENTS_Message.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChatbotMixin } from "../../mixins/ChatbotMixin";
import { MessageTypeRegistry } from "../../../application/registries/MessageTypeRegistry";

@customElement("$ARGUMENTS_kebab-message")
export class $ARGUMENTS_Message extends ChatbotMixin(LitElement) {
  static override styles = [
    ...ChatbotMixin(LitElement).styles ?? [],
    css`
      :host {
        display: block;
      }
      .container {
        padding: 0.5rem;
        border: 1px solid var(--chativa-border-color, #dee2e6);
        border-radius: 0.5rem;
      }
    `,
  ];

  @property({ type: Object }) messageData: Record<string, unknown> = {};

  render() {
    return html`
      <div class="container">
        <pre>${JSON.stringify(this.messageData, null, 2)}</pre>
      </div>
    `;
  }
}

// Self-register with the message type registry
MessageTypeRegistry.register("$ARGUMENTS_lowercase", $ARGUMENTS_Message as unknown as typeof HTMLElement);
```

## Step 2 — Write component tests

Create `src/ui/components/messages/__tests__/$ARGUMENTS_Message.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { MessageTypeRegistry } from "../../../../application/registries/MessageTypeRegistry";

// Import component to trigger self-registration
import "../$ARGUMENTS_Message";

describe("$ARGUMENTS_Message registration", () => {
  it("registers itself in MessageTypeRegistry", () => {
    expect(MessageTypeRegistry.has("$ARGUMENTS_lowercase")).toBe(true);
  });

  it("resolves the correct component class", () => {
    const Component = MessageTypeRegistry.resolve("$ARGUMENTS_lowercase");
    expect(Component).toBeDefined();
  });
});
```

## Step 3 — Export

Add to `src/index.ts`:
```ts
export { $ARGUMENTS_Message } from "./ui/components/messages/$ARGUMENTS_Message";
```

## Step 4 — Run tests

Run `npm test` and confirm all pass.
