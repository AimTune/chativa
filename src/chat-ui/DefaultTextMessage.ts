import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { MessageTypeRegistry } from "../application/registries/MessageTypeRegistry";

@customElement("default-text-message")
export class DefaultTextMessage extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    .bubble {
      background: var(--chativa-bubble-bg, #444);
      color: var(--chativa-bubble-color, #fff);
      padding: 8px 12px;
      border-radius: 8px;
      margin: 2px 0;
      max-width: 70%;
      word-break: break-word;
    }
  `;

  @property({ type: Object }) messageData: Record<string, unknown> = {};

  render() {
    return html`<div class="bubble">${this.messageData?.text as string}</div>`;
  }
}

// Self-register so any import of this file activates it
MessageTypeRegistry.register(
  "text",
  DefaultTextMessage as unknown as typeof HTMLElement
);

export default DefaultTextMessage;
