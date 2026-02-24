import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { MessageTypeRegistry, type MessageSender } from "@chativa/core";

/**
 * Video message component.
 * Renders a native HTML5 video player with optional poster and caption.
 *
 * Register a message of type "video" with:
 *   { src: "https://...", poster?: "https://...", caption?: "Caption text" }
 */
@customElement("video-message")
export class VideoMessage extends LitElement {
  static override styles = css`
    :host { display: block; }

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

    .video-wrap {
      border-radius: 4px 16px 16px 16px;
      overflow: hidden;
      background: #0f172a;
      max-width: 280px;
    }

    .message.user .video-wrap {
      border-radius: 16px 4px 16px 16px;
    }

    video {
      display: block;
      width: 100%;
      max-width: 280px;
      max-height: 200px;
      object-fit: contain;
      background: #0f172a;
    }

    .caption {
      font-size: 0.8125rem;
      color: #64748b;
      padding: 0 4px;
      max-width: 280px;
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
    const poster = this.messageData?.poster ? String(this.messageData.poster) : undefined;
    const caption = this.messageData?.caption ? String(this.messageData.caption) : null;

    return html`
      <div class="message ${isUser ? "user" : "bot"}">
        ${!isUser
          ? html`
              <div class="avatar ${this.hideAvatar ? "hidden" : ""}">
                <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="8" width="14" height="12" rx="2.5" />
                  <circle cx="9.5" cy="13" r="1.5" fill="white" />
                  <circle cx="14.5" cy="13" r="1.5" fill="white" />
                  <path d="M9.5 17c.5.5 1.4.8 2.5.8s2-.3 2.5-.8" stroke="white" stroke-width="1.2" stroke-linecap="round" fill="none" />
                </svg>
              </div>
            `
          : nothing}
        <div class="content">
          <div class="video-wrap">
            <video
              src="${src}"
              poster="${poster ?? ""}"
              controls
              preload="metadata"
              playsinline
            ></video>
          </div>
          ${caption ? html`<span class="caption">${caption}</span>` : nothing}
          ${this._time ? html`<span class="time">${this._time}</span>` : nothing}
        </div>
      </div>
    `;
  }
}

MessageTypeRegistry.register(
  "video",
  VideoMessage as unknown as typeof HTMLElement
);

export default VideoMessage;
