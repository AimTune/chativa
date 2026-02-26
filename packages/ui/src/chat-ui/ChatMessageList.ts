import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { unsafeStatic } from "lit/static-html.js";
import { html as staticHtml } from "lit/static-html.js";
import { t } from "i18next";
import i18next from "../i18n/i18n";

import { messageStore, chatStore, type StoredMessage } from "@chativa/core";

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
      position: relative;
    }

    .list {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 2px;
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

    /* Search result bar */
    .search-result-bar {
      padding: 6px 16px;
      font-size: 0.75rem;
      color: #64748b;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
      text-align: center;
    }

    /* Load more history button */
    .load-more-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 8px 12px;
      margin-bottom: 8px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      color: #64748b;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      flex-shrink: 0;
    }

    .load-more-btn:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .load-more-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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
      flex-shrink: 0;
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
  private _prevVersion = 0;
  private _prevIsTyping = false;
  /** Set to true while a history load is in-flight; cleared in updated(). */
  private _prevIsLoadingHistory = false;
  /** scrollHeight captured just before history load starts. */
  private _scrollHeightBeforeHistory = 0;

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
    const { messages, version } = messageStore.getState();
    const currentCount = messages.length;
    const { isTyping, isLoadingHistory } = chatStore.getState();

    const typingChanged = isTyping !== this._prevIsTyping;
    this._prevIsTyping = isTyping;

    // Detect when history loading just finished (true → false transition)
    const historyJustLoaded = this._prevIsLoadingHistory && !isLoadingHistory;
    this._prevIsLoadingHistory = isLoadingHistory;

    if (historyJustLoaded && this._scrollHeightBeforeHistory > 0) {
      // Restore scroll so the user stays at the same visual position after prepend
      requestAnimationFrame(() => {
        const list = this._list;
        if (list) {
          const delta = list.scrollHeight - this._scrollHeightBeforeHistory;
          list.scrollTop += delta;
        }
        this._scrollHeightBeforeHistory = 0;
      });
      this._prevMessageCount = currentCount;
      this._prevVersion = version;
      return;
    }

    const countIncreased = currentCount > this._prevMessageCount;
    // True when an existing message was mutated (e.g. GenUI chunk appended)
    const storeUpdated = version > this._prevVersion;
    this._prevMessageCount = currentCount;
    this._prevVersion = version;

    // While history is being prepended at the top, skip auto-scroll logic entirely
    if (isLoadingHistory) return;

    // After /clear — reset scroll flags
    if (currentCount === 0) {
      this._hasNewMessages = false;
      this._isAtBottom = true;
      return;
    }

    if (countIncreased) {
      // New message arrived
      if (this._isAtBottom) {
        this._pinToBottom();
      } else {
        this._hasNewMessages = true;
        this.requestUpdate();
      }
    } else if (storeUpdated && this._isAtBottom) {
      // Existing message updated (GenUI chunk, status change, etc.) — keep pinned
      this._pinToBottom();
    } else if (storeUpdated && !this._isAtBottom) {
      // GenUI update while user is scrolled up — show pill
      this._hasNewMessages = true;
      this.requestUpdate();
    } else if (typingChanged && this._isAtBottom) {
      this._pinToBottom();
    }
  }

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

  private _loadHistory() {
    // Capture scrollHeight now; updated() will apply the delta after data loads
    this._scrollHeightBeforeHistory = this._list?.scrollHeight ?? 0;
    this.dispatchEvent(
      new CustomEvent("chat-load-history", { bubbles: true, composed: true })
    );
  }

  private _renderMessage(msg: StoredMessage, i: number, messages: StoredMessage[]) {
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
      .status=${msg.status ?? "sent"}
    ></${unsafeStatic(tag)}>`;
  }

  render() {
    const messages = messageStore.getState().messages;
    const { connectorStatus, isTyping, reconnectAttempt, hasMoreHistory, isLoadingHistory, searchQuery } = chatStore.getState();

    const displayMessages = searchQuery
      ? messages.filter((msg) => {
          const text = (msg.data?.text as string | undefined) ?? "";
          const q = searchQuery.toLowerCase();
          if (text.toLowerCase().includes(q)) return true;
          try { return JSON.stringify(msg.data).toLowerCase().includes(q); }
          catch { return false; }
        })
      : messages;

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
          <div class="connecting" role="status" aria-label="${t("messageList.connecting")}">
            <div class="spinner" aria-hidden="true"></div>
            <p class="connecting-text" aria-hidden="true">${t("messageList.connecting")}</p>
          </div>
        </div>
      `;
    }

    return html`
      <div
        class="list"
        role="log"
        aria-live="polite"
        aria-label="${t("messageList.ariaLabel")}"
        aria-relevant="additions"
      >
        ${connectorStatus === "connecting" && messages.length > 0 ? html`
          <div class="reconnecting-banner" role="status">
            <div class="mini-spinner" aria-hidden="true"></div>
            ${t("messageList.reconnecting", { attempt: reconnectAttempt })}
          </div>
        ` : null}

        ${hasMoreHistory ? html`
          <button
            class="load-more-btn"
            ?disabled=${isLoadingHistory}
            @click=${this._loadHistory}
          >
            ${isLoadingHistory
              ? html`<div class="mini-spinner" role="status" aria-label="${t("messageList.loadingHistory")}"></div>`
              : html`<span aria-hidden="true">↑</span> ${t("messageList.loadMore", { defaultValue: "Load previous messages" })}`}
          </button>
        ` : null}

        ${searchQuery ? html`
          <div class="search-result-bar" role="status" aria-live="polite">
            ${displayMessages.length === 0
              ? t("messageList.searchEmpty")
              : t("messageList.searchResult", { count: displayMessages.length })}
          </div>
        ` : null}

        ${displayMessages.length === 0 && !searchQuery
          ? html`
              <div class="empty" aria-label="${t("messageList.emptyTitle")}">
                <div class="empty-icon" aria-hidden="true">
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
          : displayMessages.map((msg, i) => this._renderMessage(msg, i, displayMessages))}

        ${isTyping ? html`
          <div
            class="typing-bubble"
            role="status"
            aria-label="${t("messageList.typingIndicator")}"
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </div>
        ` : null}
      </div>
      ${this._hasNewMessages ? html`
        <button class="new-msg-pill" @click=${this._scrollToBottom}>
          <span aria-hidden="true">↓</span> ${t("messageList.newMessage")}
        </button>
      ` : null}
    `;
  }
}

export default ChatMessageList;
