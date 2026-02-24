import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { MessageTypeRegistry, type MessageSender, type MessageAction } from "@chativa/core";

/**
 * Quick-reply message component.
 * Renders a text bubble followed by tappable chip buttons.
 * On chip click, fires a `chat-action` event (bubbles + composed) with the
 * action value as detail, then hides the chips (one-time use).
 *
 * Register a message of type "quick-reply" with:
 *   { text: "...", actions: [{ label: "Yes" }, { label: "No", value: "/no" }] }
 */
@customElement("quick-reply-message")
export class QuickReplyMessage extends LitElement {
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

    .message.bot { margin-right: auto; }
    .message.user { margin-left: auto; flex-direction: row-reverse; }

    .avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #ede9fe;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .avatar.hidden { visibility: hidden; }

    .avatar svg { width: 16px; height: 16px; color: #7c3aed; }

    .content {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .message.user .content { align-items: flex-end; }

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

    .time {
      font-size: 0.6875rem;
      color: #94a3b8;
      padding: 0 4px;
    }

    /* Quick reply chips */
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
      max-width: 260px;
    }

    .chip {
      padding: 6px 14px;
      border: 1.5px solid var(--chativa-primary-color, #4f46e5);
      border-radius: 999px;
      background: transparent;
      color: var(--chativa-primary-color, #4f46e5);
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      font-family: inherit;
    }

    .chip:hover {
      background: var(--chativa-primary-color, #4f46e5);
      color: #fff;
    }

    .chip:active { opacity: 0.8; }
  `;

  @property({ type: Object }) messageData: Record<string, unknown> = {};
  @property({ type: String }) sender: MessageSender = "bot";
  @property({ type: Number }) timestamp = 0;
  @property({ type: Boolean }) hideAvatar = false;

  /** True once a chip has been tapped — chips disappear (one-time use). */
  @state() private _used = false;

  private get _time(): string {
    if (!this.timestamp) return "";
    return new Date(this.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private _onChipClick(action: MessageAction) {
    if (this._used) return;
    this._used = true;
    this.dispatchEvent(
      new CustomEvent<string>("chat-action", {
        detail: action.value ?? action.label,
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const isUser = this.sender === "user";
    const actions = this.messageData?.actions as MessageAction[] | undefined;

    return html`
      <div class="message ${isUser ? "user" : "bot"}">
        ${!isUser
          ? html`
              <div class="avatar ${this.hideAvatar ? "hidden" : ""}">
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
              </div>
            `
          : nothing}
        <div class="content">
          <div class="bubble">${this.messageData?.text as string}</div>
          ${!this._used && actions && actions.length > 0 ? html`
            <div class="chips">
              ${actions.map(
                (action) => html`
                  <button
                    class="chip"
                    type="button"
                    @click=${() => this._onChipClick(action)}
                  >${action.label}</button>
                `
              )}
            </div>
          ` : nothing}
          ${this._time && !this.hideAvatar
            ? html`<span class="time">${this._time}</span>`
            : nothing}
        </div>
      </div>
    `;
  }
}

MessageTypeRegistry.register(
  "quick-reply",
  QuickReplyMessage as unknown as typeof HTMLElement
);

export default QuickReplyMessage;
