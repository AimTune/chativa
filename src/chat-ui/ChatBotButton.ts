import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { ChatbotMixin } from "../mixins/ChatbotMixin";

@customElement("chat-bot-button")
class ChatBotButton extends ChatbotMixin(LitElement) {
  static override styles = css`
    :host {
      display: block;
    }

    .launcher {
      position: fixed;
      cursor: pointer;
      border: none;
      outline: none;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(
        135deg,
        var(--chativa-primary-color, #4f46e5) 0%,
        var(--chativa-primary-dark, #7c3aed) 100%
      );
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(79, 70, 229, 0.45),
        0 2px 8px rgba(0, 0, 0, 0.12);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 0.2s ease;
      z-index: 10000;
      padding: 0;
    }

    .launcher:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(79, 70, 229, 0.55),
        0 4px 14px rgba(0, 0, 0, 0.18);
    }

    .launcher:active {
      transform: scale(0.94);
    }

    .icon-wrap {
      position: relative;
      width: 24px;
      height: 24px;
    }

    .icon-wrap svg {
      position: absolute;
      inset: 0;
      width: 24px;
      height: 24px;
      transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .icon-chat {
      opacity: 1;
      transform: scale(1) rotate(0deg);
    }

    .icon-close {
      opacity: 0;
      transform: scale(0.4) rotate(-90deg);
    }

    .launcher.is-open .icon-chat {
      opacity: 0;
      transform: scale(0.4) rotate(90deg);
    }

    .launcher.is-open .icon-close {
      opacity: 1;
      transform: scale(1) rotate(0deg);
    }
  `;

  #positionStyle(): string {
    const { position, positionMargin } = this.theme;
    const m = positionMargin ? `${Number(positionMargin) * 0.5 + 0.5}rem` : "1rem";
    const [v, h] = (position ?? "bottom-right").split("-");
    return `${v}: ${m}; ${h}: ${m};`;
  }

  render() {
    const isOpen = this.themeState.isOpened;
    return html`
      <button
        class="launcher ${isOpen ? "is-open" : ""}"
        style="${this.#positionStyle()}"
        @click=${() => this.themeState.toggle()}
        aria-label="${isOpen ? "Close chat" : "Open chat"}"
      >
        <span class="icon-wrap">
          <!-- Chat bubble icon -->
          <svg
            class="icon-chat"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 10H6V10h12v2zm0-3H6V7h12v2z"
            />
          </svg>
          <!-- Close icon -->
          <svg
            class="icon-close"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </span>
      </button>
    `;
  }
}

export default ChatBotButton;
