import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("default-text-message")
export class DefaultTextMessage extends LitElement {
  @property({ type: Object }) messageData: any;

  render() {
    console.log("DefaultTextMessage render çağrıldı");
    return html`<div
      style="background:#444;padding:8px 12px;border-radius:8px;margin:2px 0;color:#fff;max-width:70%;word-break:break-word;"
    >
      ${this.messageData?.text}
    </div>`;
  }
}
