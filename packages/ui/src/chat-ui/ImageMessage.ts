import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { MessageTypeRegistry, type MessageSender } from "@chativa/core";

/**
 * Image message component.
 * Renders a bot bubble containing an image, with an optional caption below.
 *
 * Register a message of type "image" with:
 *   { src: "https://...", alt?: "description", caption?: "Caption text" }
 */
@customElement("image-message")
export class ImageMessage extends LitElement {
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

    .image-wrap {
      border-radius: 4px 16px 16px 16px;
      overflow: hidden;
      background: #f1f5f9;
      max-width: 240px;
      cursor: pointer;
    }

    .message.user .image-wrap {
      border-radius: 16px 4px 16px 16px;
    }

    .image-wrap img {
      display: block;
      width: 100%;
      max-width: 240px;
      object-fit: cover;
      transition: opacity 0.2s;
    }

    .image-wrap img.loading {
      opacity: 0;
    }

    .skeleton {
      width: 240px;
      height: 160px;
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .caption {
      font-size: 0.8125rem;
      color: #64748b;
      padding: 0 4px;
      max-width: 240px;
      line-height: 1.4;
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

  @state() private _loaded = false;

  private get _time(): string {
    if (!this.timestamp) return "";
    return new Date(this.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  render() {
    const isUser = this.sender === "user";
    const src = String(this.messageData?.src ?? "");
    const alt = String(this.messageData?.alt ?? "");
    const caption = this.messageData?.caption
      ? String(this.messageData.caption)
      : null;

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
          <div
            class="image-wrap"
            @click=${() => src && window.open(src, "_blank")}
            title="${alt || "image"}"
          >
            ${!this._loaded ? html`<div class="skeleton"></div>` : nothing}
            <img
              src="${src}"
              alt="${alt}"
              class="${this._loaded ? "" : "loading"}"
              @load=${() => { this._loaded = true; }}
            />
          </div>
          ${caption ? html`<span class="caption">${caption}</span>` : nothing}
          ${this._time ? html`<span class="time">${this._time}</span>` : nothing}
        </div>
      </div>
    `;
  }
}

MessageTypeRegistry.register(
  "image",
  ImageMessage as unknown as typeof HTMLElement
);

export default ImageMessage;
