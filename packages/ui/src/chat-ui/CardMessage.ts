import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { MessageTypeRegistry, type MessageSender, type MessageAction } from "@chativa/core";

/**
 * Hero card message component.
 * Renders a structured card with an optional image, title, subtitle and action buttons.
 * Buttons dispatch `chat-action` events (bubbles + composed) with the action value.
 *
 * Register a message of type "card" with:
 *   {
 *     image?: "https://...",
 *     title: "Card Title",
 *     subtitle?: "Supporting text",
 *     buttons?: [{ label: "Learn More", value?: "/learn-more" }]
 *   }
 */
@customElement("card-message")
export class CardMessage extends LitElement {
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

    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      width: 260px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    }

    .card-image {
      width: 100%;
      height: 140px;
      object-fit: cover;
      display: block;
    }

    .card-image-skeleton {
      width: 100%;
      height: 140px;
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .card-body {
      padding: 12px 14px;
    }

    .card-title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 4px;
      line-height: 1.35;
    }

    .card-subtitle {
      font-size: 0.8125rem;
      color: #64748b;
      margin: 0;
      line-height: 1.45;
    }

    .card-divider {
      height: 1px;
      background: #f1f5f9;
      margin: 0;
    }

    .card-actions {
      display: flex;
      flex-direction: column;
    }

    .card-btn {
      background: none;
      border: none;
      border-bottom: 1px solid #f1f5f9;
      padding: 10px 14px;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--chativa-primary-color, #4f46e5);
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: background 0.15s;
    }

    .card-btn:last-child {
      border-bottom: none;
    }

    .card-btn:hover {
      background: #f8fafc;
    }

    .card-btn:active {
      background: #f1f5f9;
    }

    .time {
      font-size: 0.6875rem;
      color: #94a3b8;
      padding: 0 4px;
    }
  `;

  @property({ type: Object }) messageData: Record<string, unknown> = {};
  @property({ type: String }) sender: MessageSender = "bot";
  @property({ type: Number }) timestamp = 0;
  @property({ type: Boolean }) hideAvatar = false;

  @state() private _imgLoaded = false;

  private get _time(): string {
    if (!this.timestamp) return "";
    return new Date(this.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private _onButtonClick(action: MessageAction) {
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
    const image = this.messageData?.image ? String(this.messageData.image) : null;
    const title = String(this.messageData?.title ?? "");
    const subtitle = this.messageData?.subtitle
      ? String(this.messageData.subtitle)
      : null;
    const buttons = (this.messageData?.buttons ?? []) as MessageAction[];

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
          <div class="card">
            ${image
              ? html`
                  ${!this._imgLoaded ? html`<div class="card-image-skeleton"></div>` : nothing}
                  <img
                    class="card-image"
                    src="${image}"
                    alt="${title}"
                    style="${this._imgLoaded ? "" : "display:none"}"
                    @load=${() => { this._imgLoaded = true; }}
                  />
                `
              : nothing}
            <div class="card-body">
              <p class="card-title">${title}</p>
              ${subtitle ? html`<p class="card-subtitle">${subtitle}</p>` : nothing}
            </div>
            ${buttons.length > 0 ? html`
              <div class="card-divider"></div>
              <div class="card-actions">
                ${buttons.map(
                  (btn) => html`
                    <button
                      class="card-btn"
                      type="button"
                      @click=${() => this._onButtonClick(btn)}
                    >${btn.label}</button>
                  `
                )}
              </div>
            ` : nothing}
          </div>
          ${this._time ? html`<span class="time">${this._time}</span>` : nothing}
        </div>
      </div>
    `;
  }
}

MessageTypeRegistry.register(
  "card",
  CardMessage as unknown as typeof HTMLElement
);

export default CardMessage;
