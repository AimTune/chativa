import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { unsafeStatic } from "lit/static-html.js";
import { html as staticHtml } from "lit/static-html.js";
import messageStore from "../application/stores/MessageStore";
import chatStore from "../application/stores/ChatStore";

function resolveTag(component: typeof HTMLElement): string {
  const name = customElements.getName?.(component);
  return name ?? "default-text-message";
}

@customElement("chat-message-list")
class ChatMessageList extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .list {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      scroll-behavior: smooth;
    }

    /* Custom scrollbar */
    .list::-webkit-scrollbar {
      width: 4px;
    }
    .list::-webkit-scrollbar-track {
      background: transparent;
    }
    .list::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 4px;
    }
    .list::-webkit-scrollbar-thumb:hover {
      background: #cbd5e1;
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      gap: 12px;
      padding: 24px;
      text-align: center;
    }

    .empty-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #ede9fe;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .empty-icon svg {
      width: 28px;
      height: 28px;
      color: #7c3aed;
    }

    .empty-title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .empty-subtitle {
      font-size: 0.8125rem;
      color: #64748b;
      margin: 0;
    }

    /* Loading state */
    .connecting {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      gap: 14px;
      padding: 24px;
      text-align: center;
    }

    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #e2e8f0;
      border-top-color: var(--chativa-primary-color, #4f46e5);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .connecting-text {
      font-size: 0.8125rem;
      color: #64748b;
      margin: 0;
    }
  `;

  private _unsubscribeMessages!: () => void;
  private _unsubscribeChatStore!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribeMessages = messageStore.subscribe(() =>
      this.requestUpdate()
    );
    this._unsubscribeChatStore = chatStore.subscribe(() =>
      this.requestUpdate()
    );
  }

  disconnectedCallback() {
    this._unsubscribeMessages?.();
    this._unsubscribeChatStore?.();
    super.disconnectedCallback();
  }

  updated() {
    // Auto-scroll to bottom on new messages
    const list = this.shadowRoot?.querySelector(".list");
    if (list) list.scrollTop = list.scrollHeight;
  }

  render() {
    const messages = messageStore.getState().messages;
    const { connectorStatus } = chatStore.getState();

    if (connectorStatus === "connecting" && messages.length === 0) {
      return html`
        <div class="list">
          <div class="connecting">
            <div class="spinner"></div>
            <p class="connecting-text">Connecting…</p>
          </div>
        </div>
      `;
    }

    return html`
      <div class="list">
        ${messages.length === 0
          ? html`
              <div class="empty">
                <div class="empty-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 10H6V10h12v2zm0-3H6V7h12v2z"
                    />
                  </svg>
                </div>
                <p class="empty-title">How can I help you?</p>
                <p class="empty-subtitle">Send a message to get started.</p>
              </div>
            `
          : messages.map((msg) => {
              const tag = msg.component
                ? resolveTag(msg.component)
                : "default-text-message";
              return staticHtml`<${unsafeStatic(tag)}
                .messageData=${msg.data}
                .sender=${msg.from ?? "bot"}
                .timestamp=${msg.timestamp ?? 0}
              ></${unsafeStatic(tag)}>`;
            })}
      </div>
    `;
  }
}

export default ChatMessageList;
