import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { unsafeStatic } from "lit/static-html.js";
import { html as staticHtml } from "lit/static-html.js";
import messageStore from "../application/stores/MessageStore";

/** Resolve the custom element tag name from a component constructor. */
function resolveTag(component: typeof HTMLElement): string {
  // customElements.getName is available in Chrome 117+/Firefox 116+
  const name = customElements.getName?.(component);
  return name ?? "default-text-message";
}

@customElement("chat-message-list")
class ChatMessageList extends LitElement {
  private _unsubscribeMessages!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribeMessages = messageStore.subscribe(() =>
      this.requestUpdate()
    );
  }

  disconnectedCallback() {
    this._unsubscribeMessages?.();
    super.disconnectedCallback();
  }

  render() {
    const messages = messageStore.getState().messages;
    return html`
      <div
        class="chat-message-list"
        style="min-height:200px;max-height:400px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;"
      >
        ${messages.map((msg) => {
          const tag = msg.component
            ? resolveTag(msg.component)
            : "default-text-message";
          return staticHtml`<${unsafeStatic(tag)} .messageData=${
            msg.data
          }></${unsafeStatic(tag)}>`;
        })}
      </div>
    `;
  }
}

export default ChatMessageList;
