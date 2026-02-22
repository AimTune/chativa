import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { t } from "i18next";
import { ChatbotMixin } from "../mixins/ChatbotMixin";

@customElement("chat-header")
class ChatHeader extends ChatbotMixin(LitElement) {
  static override styles = css`
    :host {
      display: block;
      flex-shrink: 0;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: linear-gradient(
        135deg,
        var(--chativa-primary-color, #4f46e5) 0%,
        var(--chativa-primary-dark, #7c3aed) 100%
      );
    }

    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .avatar svg {
      width: 22px;
      height: 22px;
      color: white;
    }

    .info {
      flex: 1;
      min-width: 0;
    }

    .title {
      display: block;
      color: white;
      font-weight: 700;
      font-size: 0.9375rem;
      letter-spacing: -0.01em;
      line-height: 1.25;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 3px;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #4ade80;
      flex-shrink: 0;
    }

    .status-text {
      color: rgba(255, 255, 255, 0.75);
      font-size: 0.75rem;
      font-weight: 400;
    }

    .close-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: rgba(255, 255, 255, 0.12);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease;
      flex-shrink: 0;
      padding: 0;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .close-btn svg {
      width: 15px;
      height: 15px;
    }
  `;

  render() {
    return html`
      <div class="header">
        <div class="avatar">
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
            <path d="M12 5v3" stroke="white" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="12" cy="4" r="1.5" fill="white" />
          </svg>
        </div>

        <div class="info">
          <span class="title">${t("title")}</span>
          <div class="status">
            <span class="status-dot"></span>
            <span class="status-text">Online</span>
          </div>
        </div>

        <button
          class="close-btn"
          @click=${() => this.themeState.close()}
          aria-label="Close chat"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    `;
  }
}

export default ChatHeader;
