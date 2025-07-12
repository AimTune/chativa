import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("chat-header")
class ChatHeader extends LitElement {
  render() {
    return html`<div class="chat-header">Chativa</div>`;
  }
}

export default ChatHeader;