# Custom Message Types

Register a LitElement to render any `type` string. When an incoming message arrives with that type, your component is mounted and `messageData` is set to the message's `data` payload.

## Implement `IMessageRenderer`

```ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChatbotMixin } from "@chativa/ui";          // re-exports I18nMixin too
import { MessageTypeRegistry } from "@chativa/core";

@customElement("product-card-message")
export class ProductCardMessage extends ChatbotMixin(LitElement) {
  @property({ type: Object }) messageData: Record<string, unknown> = {};

  static styles = css`
    :host { display: block; }
    .card { border: 1px solid var(--chativa-border-color); border-radius: 12px; padding: 12px; }
  `;

  render() {
    const { name, price, image } = this.messageData as {
      name: string; price: string; image?: string;
    };
    return html`
      <div class="card">
        ${image ? html`<img src=${image} alt="" />` : null}
        <h3>${name}</h3>
        <p>${price}</p>
      </div>
    `;
  }
}

// Side-effect register on import
MessageTypeRegistry.register("product-card", ProductCardMessage);
```

Then any incoming `{ type: "product-card", data: { name, price, image } }` is rendered with your component.

## Override a built-in

Built-in types are registered when `@chativa/ui` loads. Re-registering after that point overrides them:

```ts
import "@chativa/ui";                   // built-ins register here
import { MessageTypeRegistry } from "@chativa/core";
import { MyFancyTextMessage } from "./MyFancyTextMessage";

MessageTypeRegistry.register("text", MyFancyTextMessage);   // overrides default text
```

## Tips

- Extend `ChatbotMixin(LitElement)` — it brings `I18nMixin` and styling tokens.
- Read CSS variables (`--chativa-primary-color`, `--chativa-bubble-bot-bg`, …) in your styles to inherit the active theme.
- Need to send a message back from inside your component? Use the `chativa-action` custom event:

```ts
this.dispatchEvent(new CustomEvent("chativa-action", {
  bubbles: true, composed: true,
  detail: { value: "buy_now", label: "Buy now" },
}));
```

The widget converts that into an outgoing `text` message via the chat input.
