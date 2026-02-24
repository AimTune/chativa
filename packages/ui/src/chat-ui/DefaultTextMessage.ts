import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import { MessageTypeRegistry, chatStore, type MessageSender, type MessageStatus } from "@chativa/core";


@customElement("default-text-message")
export class DefaultTextMessage extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .message {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      max-width: 82%;
      margin-bottom: 2px;
    }

    .message.bot {
      margin-right: auto;
    }

    .message.user {
      margin-left: auto;
      flex-direction: row-reverse;
    }

    .avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #ede9fe;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }

    .avatar.hidden { visibility: hidden; }

    .avatar.user-avatar {
      background: #e0f2fe;
    }

    .avatar svg {
      width: 16px;
      height: 16px;
      color: #7c3aed;
    }

    .avatar.user-avatar svg {
      color: #0369a1;
    }

    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    /* Markdown styles for bot bubbles */
    .message.bot .bubble p { margin: 0 0 6px; }
    .message.bot .bubble p:last-child { margin: 0; }
    .message.bot .bubble code {
      background: rgba(0,0,0,0.08);
      border-radius: 3px;
      padding: 1px 5px;
      font-size: 0.82em;
      font-family: monospace;
    }
    .message.bot .bubble pre {
      background: rgba(0,0,0,0.06);
      border-radius: 6px;
      padding: 8px 12px;
      overflow-x: auto;
      margin: 6px 0;
    }
    .message.bot .bubble pre code { background: none; padding: 0; }
    .message.bot .bubble a { color: #4f46e5; text-decoration: underline; }
    .message.bot .bubble ul,
    .message.bot .bubble ol { margin: 4px 0; padding-left: 18px; }
    .message.bot .bubble strong { font-weight: 600; }
    .message.bot .bubble em { font-style: italic; }

    .content {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .message.user .content {
      align-items: flex-end;
    }

    .bubble {
      padding: 9px 13px;
      font-size: 0.875rem;
      line-height: 1.5;
      word-break: break-word;
      max-width: 100%;
    }

    .message.bot .bubble {
      background: #f1f5f9;
      color: #0f172a;
      border-radius: 4px 16px 16px 16px;
    }

    .message.user .bubble {
      background: var(--chativa-primary-color, #4f46e5);
      color: #ffffff;
      border-radius: 16px 4px 16px 16px;
    }

    .meta {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .message.user .meta {
      justify-content: flex-end;
    }

    .time {
      font-size: 0.6875rem;
      color: #94a3b8;
      padding: 0 2px;
    }

    /* Status tick icons */
    .status-icon {
      display: flex;
      align-items: center;
      line-height: 1;
    }

    .status-icon svg {
      width: 14px;
      height: 14px;
    }

    .feedback {
      display: flex;
      gap: 2px;
      opacity: 0;
      transition: opacity 0.15s;
      padding: 0 2px;
    }

    .message.bot:hover .feedback,
    .feedback.active {
      opacity: 1;
    }

    .feedback-btn {
      background: none;
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 2px 5px;
      cursor: pointer;
      font-size: 0.75rem;
      line-height: 1;
      color: #94a3b8;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }

    .feedback-btn:hover {
      border-color: #e2e8f0;
      background: #f8fafc;
      color: #64748b;
    }

    .feedback-btn.selected-like {
      border-color: #bbf7d0;
      background: #f0fdf4;
      color: #16a34a;
    }

    .feedback-btn.selected-dislike {
      border-color: #fecaca;
      background: #fef2f2;
      color: #dc2626;
    }
  `;

  @property({ type: Object }) messageData: Record<string, unknown> = {};
  @property({ type: String }) sender: MessageSender = "bot";
  @property({ type: String }) messageId = "";
  @property({ type: Number }) timestamp = 0;
  /** When true the avatar is invisible (still occupies space for alignment). */
  @property({ type: Boolean }) hideAvatar = false;
  @property({ type: String }) status: MessageStatus = "sent";

  @state() private _feedback: "like" | "dislike" | null = null;

  private _onFeedback(type: "like" | "dislike") {
    if (this._feedback === type) {
      this._feedback = null;
      return;
    }
    this._feedback = type;
    this.dispatchEvent(
      new CustomEvent("chativa-feedback", {
        bubbles: true,
        composed: true,
        detail: { messageId: this.messageId, feedback: type },
      })
    );
  }

  private get _time(): string {
    if (!this.timestamp) return "";
    return new Date(this.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private _renderBotAvatar(avatarUrl?: string) {
    return html`
      <div class="avatar ${this.hideAvatar ? "hidden" : ""}">
        ${avatarUrl
          ? html`<img src=${avatarUrl} alt="bot avatar" />`
          : html`
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="8" width="14" height="12" rx="2.5" />
                <circle cx="9.5" cy="13" r="1.5" fill="white" />
                <circle cx="14.5" cy="13" r="1.5" fill="white" />
                <path
                  d="M9.5 17c.5.5 1.4.8 2.5.8s2-.3 2.5-.8"
                  stroke="white"
                  stroke-width="1.2"
                  stroke-linecap="round"
                  fill="none"
                />
              </svg>
            `}
      </div>
    `;
  }

  private _renderUserAvatar(avatarUrl?: string) {
    return html`
      <div class="avatar user-avatar ${this.hideAvatar ? "hidden" : ""}">
        ${avatarUrl
          ? html`<img src=${avatarUrl} alt="user avatar" />`
          : html`
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
            `}
      </div>
    `;
  }

  private _renderStatusIcon() {
    const color = this.status === "sending" ? "#94a3b8" : "var(--chativa-primary-color, #4f46e5)";
    if (this.status === "read") {
      // Double tick
      return html`
        <span class="status-icon" title="Read">
          <svg viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 6l4 4L13 1" stroke=${color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 6l4 4L18 1" stroke=${color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      `;
    }
    // Single tick (sending = gray, sent = primary)
    return html`
      <span class="status-icon" title=${this.status === "sending" ? "Sending…" : "Sent"}>
        <svg viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 5l4 4L13 1" stroke=${color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    `;
  }

  render() {
    const isUser = this.sender === "user";
    const raw = String(this.messageData?.text ?? "");
    const bubbleContent = isUser
      ? raw
      : unsafeHTML(marked.parse(raw, { async: false }) as string);

    const theme = chatStore.getState().theme;
    const avatarCfg = theme.avatar;
    const showBotAvatar = avatarCfg?.showBot !== false;
    const showUserAvatar = avatarCfg?.showUser !== false;
    const showStatus = theme.showMessageStatus === true && isUser;

    return html`
      <div class="message ${isUser ? "user" : "bot"}">
        ${!isUser && showBotAvatar ? this._renderBotAvatar(avatarCfg?.bot) : nothing}
        ${isUser && showUserAvatar ? this._renderUserAvatar(avatarCfg?.user) : nothing}
        <div class="content">
          <div class="bubble">${bubbleContent}</div>
          ${!isUser ? html`
            <div class="feedback ${this._feedback ? "active" : ""}">
              <button
                class="feedback-btn ${this._feedback === "like" ? "selected-like" : ""}"
                title="Like"
                @click=${() => this._onFeedback("like")}
              >👍</button>
              <button
                class="feedback-btn ${this._feedback === "dislike" ? "selected-dislike" : ""}"
                title="Dislike"
                @click=${() => this._onFeedback("dislike")}
              >👎</button>
            </div>
          ` : nothing}
          ${this._time || showStatus ? html`
            <div class="meta">
              ${this._time ? html`<span class="time">${this._time}</span>` : nothing}
              ${showStatus ? this._renderStatusIcon() : nothing}
            </div>
          ` : nothing}
        </div>
      </div>
    `;
  }
}

MessageTypeRegistry.register(
  "text",
  DefaultTextMessage as unknown as typeof HTMLElement
);

export default DefaultTextMessage;
