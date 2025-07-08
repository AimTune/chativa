import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { unsafeStatic } from "lit/static-html.js";
import { html as staticHtml } from "lit/static-html.js";
import useMessageStore from "../chat-core/messageStore";

@customElement("chat-message-list")
class ChatMessageList extends LitElement {
  private unsubscribeMessages!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribeMessages = useMessageStore.subscribe(() =>
      this.requestUpdate()
    );
  }

  disconnectedCallback() {
    this.unsubscribeMessages?.();
    super.disconnectedCallback();
  }

  render() {
    const messages = useMessageStore.getState().messages;
    return html`
      <div
        class="chat-message-list"
        style="min-height:200px;max-height:400px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;"
      >
        ${messages.map((msg) => {
          let tag = "default-text-message";
          if (msg.component && msg.component.name === "DefaultTextMessage") {
            tag = "default-text-message";
          }
          return staticHtml`<${unsafeStatic(tag)} .messageData=${
            msg.data
          }></${unsafeStatic(tag)}>`;
        })}
      </div>
    `;
  }
}
