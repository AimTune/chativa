import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { unsafeStatic } from "lit/static-html.js";
import { html as staticHtml } from "lit/static-html.js";
import { t } from "i18next";
import i18next from "../i18n/i18n";

import { messageStore, chatStore } from "@chativa/core";

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

    /* Typing indicator */
    .typing-bubble {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 10px 14px;
      background: #f1f5f9;
      border-radius: 18px 18px 18px 4px;
      width: fit-content;
      margin-top: 4px;
    }

    .typing-bubble span {
      display: block;
      width: 7px;
      height: 7px;
      background: #94a3b8;
      border-radius: 50%;
      animation: typing-bounce 1.2s infinite ease-in-out;
    }

    .typing-bubble span:nth-child(1) { animation-delay: 0s; }
    .typing-bubble span:nth-child(2) { animation-delay: 0.2s; }
    .typing-bubble span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    /* New-message pill */
    .new-msg-pill {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--chativa-primary-color, #4f46e5);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 999px;
      cursor: pointer;
      border: none;
      box-shadow: 0 4px 14px rgba(79,70,229,0.35);
      display: flex;
      align-items: center;
      gap: 6px;
      animation: pill-in 0.2s ease;
      white-space: nowrap;
      z-index: 10;
    }

    @keyframes pill-in {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    /* Make host relative so pill can be positioned inside */
    :host {
      position: relative;
    }

    /* Reduce gap between grouped messages */
    .list {
      gap: 2px;
    }

    /* Reconnecting banner */
    .reconnecting-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: #fefce8;
      border: 1px solid #fde047;
      border-radius: 10px;
      margin-bottom: 8px;
      font-size: 0.8125rem;
      color: #854d0e;
    }

    .mini-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #fde047;
      border-top-color: #854d0e;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }

    /* Error state */
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      gap: 14px;
      padding: 24px;
      text-align: center;
    }

    .error-icon {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #fee2e2;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .error-icon svg { width: 26px; height: 26px; color: #ef4444; }

    .error-title { font-size: 0.9375rem; font-weight: 600; color: #0f172a; margin: 0; }
    .error-subtitle { font-size: 0.8125rem; color: #64748b; margin: 0; }

    .retry-btn {
      padding: 8px 20px;
      background: var(--chativa-primary-color, #4f46e5);
      color: #fff;
      border: none;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .retry-btn:hover { opacity: 0.88; }
  `;

  private _onLangChange = () => { this.requestUpdate(); };

  private _unsubscribeMessages!: () => void;
  private _unsubscribeChatStore!: () => void;
  private _isAtBottom = true;
  private _hasNewMessages = false;
  private _prevMessageCount = 0;
  private _prevIsTyping = false;

  private get _list(): Element | null {
    return this.shadowRoot?.querySelector(".list") ?? null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribeMessages = messageStore.subscribe(() =>
      this.requestUpdate()
    );
    this._unsubscribeChatStore = chatStore.subscribe(() =>
      this.requestUpdate()
    );
    i18next.on("languageChanged", this._onLangChange);
  }

  disconnectedCallback() {
    this._unsubscribeMessages?.();
    this._unsubscribeChatStore?.();
    i18next.off("languageChanged", this._onLangChange);
    this._list?.removeEventListener("scroll", this._onScroll);
    super.disconnectedCallback();
  }

  private _onScroll = () => {
    const list = this._list;
    if (!list) return;
    const threshold = 60;
    this._isAtBottom =
      list.scrollTop + list.clientHeight >= list.scrollHeight - threshold;
    if (this._isAtBottom) {
      this._hasNewMessages = false;
      this.requestUpdate();
    }
  };

  firstUpdated() {
    this._list?.addEventListener("scroll", this._onScroll, { passive: true });
  }

  updated() {
    const currentCount = messageStore.getState().messages.length;
    const hasMore = currentCount > this._prevMessageCount;
    this._prevMessageCount = currentCount;

    const { isTyping } = chatStore.getState();
    const typingChanged = isTyping !== this._prevIsTyping;
    this._prevIsTyping = isTyping;

    if (hasMore) {
      if (this._isAtBottom) {
        this._pinToBottom();
      } else {
        this._hasNewMessages = true;
        this.requestUpdate();
      }
    } else if (typingChanged && this._isAtBottom) {
      // Only pin when typing indicator appears/disappears, not on every re-render
      this._pinToBottom();
    }
  }

  /** Scroll to the very bottom — only if the user is still at bottom when rAF fires. */
  private _pinToBottom() {
    requestAnimationFrame(() => {
      if (!this._isAtBottom) return;
      const list = this._list;
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  private _scrollToBottom() {
    const list = this._list;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    this._isAtBottom = true;
    this._hasNewMessages = false;
    this.requestUpdate();
  }

  private _retry() {
    this.dispatchEvent(
      new CustomEvent("chat-retry", { bubbles: true, composed: true })
    );
  }

  render() {
    const messages = messageStore.getState().messages;
    const { connectorStatus, isTyping, reconnectAttempt } = chatStore.getState();

    // Error state: all reconnect attempts exhausted
    if (connectorStatus === "error") {
      return html`
        <div class="list">
          <div class="error-state">
            <div class="error-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </div>
            <p class="error-title">${t("messageList.errorTitle")}</p>
            <p class="error-subtitle">${t("messageList.errorSubtitle")}</p>
            <button class="retry-btn" @click=${this._retry}>${t("messageList.retry")}</button>
          </div>
        </div>
      `;
    }

    // Initial connecting (no messages yet)
    if (connectorStatus === "connecting" && messages.length === 0) {
      return html`
        <div class="list">
          <div class="connecting">
            <div class="spinner"></div>
            <p class="connecting-text">${t("messageList.connecting")}</p>
          </div>
        </div>
      `;
    }

    return html`
      <div
        class="list"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        aria-relevant="additions"
      >
        ${connectorStatus === "connecting" && messages.length > 0 ? html`
          <div class="reconnecting-banner">
            <div class="mini-spinner"></div>
            ${t("messageList.reconnecting", { attempt: reconnectAttempt })}
          </div>
        ` : null}
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
                <p class="empty-title">${t("messageList.emptyTitle")}</p>
                <p class="empty-subtitle">${t("messageList.emptySubtitle")}</p>
              </div>
            `
          : messages.map((msg, i) => {
              const tag = msg.component
                ? resolveTag(msg.component)
                : "default-text-message";
              const next = messages[i + 1];
              const isLastInGroup = !next || next.from !== msg.from;
              return staticHtml`<${unsafeStatic(tag)}
                .messageData=${msg.data}
                .sender=${msg.from ?? "bot"}
                .messageId=${msg.id}
                .timestamp=${isLastInGroup ? (msg.timestamp ?? 0) : 0}
                .hideAvatar=${!isLastInGroup}
              ></${unsafeStatic(tag)}>`;
            })}
        ${isTyping ? html`
          <div class="typing-bubble">
            <span></span><span></span><span></span>
          </div>
        ` : null}
      </div>
      ${this._hasNewMessages ? html`
        <button class="new-msg-pill" @click=${this._scrollToBottom}>
          ↓ ${t("messageList.newMessage")}
        </button>
      ` : null}
    `;
  }
}

export default ChatMessageList;
