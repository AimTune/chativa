import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { t } from "i18next";
import { ChatbotMixin } from "../mixins/ChatbotMixin";

const SIZE_PX: Record<string, number> = { small: 44, medium: 56, large: 68 };

@customElement("chat-bot-button")
class ChatBotButton extends ChatbotMixin(LitElement) {
  static override styles = css`
    :host {
      display: block;
    }

    /**
     * .launcher — the positioned wrapper that handles placement + click.
     * Expose via ::part(launcher) so consumers can fully override appearance.
     *
     * Default slot: if no children are provided the gradient circle + animated
     * icons are shown.  When children ARE slotted in, the wrapper stays
     * positioned and handles the toggle, but the visual is entirely up to the
     * consumer.
     */
    .launcher {
      position: fixed;
      cursor: pointer;
      border: none;
      outline: none;
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

    /* When the slot has custom content, fully reset default styles so the
       consumer's slotted element defines the appearance.
       !important needed to override the inline width/height from #positionStyle(). */
    .launcher.has-slot {
      background: transparent;
      box-shadow: none;
      border-radius: 0;
      width: auto !important;
      height: auto !important;
    }

    .launcher:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(79, 70, 229, 0.55),
        0 4px 14px rgba(0, 0, 0, 0.18);
    }

    .launcher.has-slot:hover {
      transform: scale(1.08);
      box-shadow: none;
    }

    .launcher:active {
      transform: scale(0.94);
    }

    .launcher:focus-visible {
      outline: 3px solid var(--chativa-primary-color, #4f46e5);
      outline-offset: 3px;
    }

    /* Default icon animation (only shown when no slot content) */
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

    /* Slotted content — display as block so images keep their natural aspect ratio */
    ::slotted(*) {
      display: block;
    }

    /* Unread badge */
    .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      background: #ef4444;
      color: #fff;
      border-radius: 999px;
      font-size: 0.6875rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 0 2px #fff;
      pointer-events: none;
      line-height: 1;
      animation: badge-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes badge-pop {
      from { transform: scale(0); }
      to   { transform: scale(1); }
    }

    /* When slotted content is provided and hideButtonOnOpen is enabled,
       hide the button while chat is open */
    .launcher.has-slot.hide-on-open.is-open {
      display: none;
    }

    /* On mobile chat goes fullscreen — hide the toggle button so it
       doesn't float above the open chat panel. */
    @media (max-width: 480px) {
      .launcher.is-open {
        display: none;
      }
    }
  `;

  /** True when consumer has placed content in the default slot */
  @state() private _hasSlot = false;

  private _onSlotChange(e: Event) {
    const slot = e.target as HTMLSlotElement;
    this._hasSlot = slot.assignedNodes({ flatten: true }).length > 0;
  }

  #positionStyle(): string {
    const { position, positionMargin, size } = this.theme;
    const m = positionMargin ? `${Number(positionMargin) * 0.5 + 0.5}rem` : "1rem";
    const [v, h] = (position ?? "bottom-right").split("-");
    if (this._hasSlot) {
      return `${v}: ${m}; ${h}: ${m};`;
    }
    const px = SIZE_PX[size ?? "medium"] ?? 56;
    return `${v}: ${m}; ${h}: ${m}; width: ${px}px; height: ${px}px;`;
  }

  render() {
    const { isOpened: isOpen, unreadCount } = this.themeState;
    const hideOnOpen = this.theme.hideButtonOnOpen === true;
    const classes = [
      "launcher",
      isOpen ? "is-open" : "",
      this._hasSlot ? "has-slot" : "",
      this._hasSlot && hideOnOpen ? "hide-on-open" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return html`
      <button
        class="${classes}"
        part="launcher"
        style="${this.#positionStyle()}"
        @click=${() => this.themeState.toggle()}
        aria-label="${isOpen ? t("chatButton.close") : t("chatButton.open")}"
        aria-expanded="${isOpen}"
      >
        <slot @slotchange=${this._onSlotChange}>
          <!-- Default: animated chat / close icons -->
          <span class="icon-wrap" aria-hidden="true">
            <svg
              class="icon-chat"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 10H6V10h12v2zm0-3H6V7h12v2z"
              />
            </svg>
            <svg
              class="icon-close"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </span>
        </slot>
        ${unreadCount > 0 && !isOpen
          ? html`<span class="badge" aria-label="${unreadCount} unread messages">
              <span aria-hidden="true">${unreadCount > 9 ? "9+" : unreadCount}</span>
            </span>`
          : nothing}
      </button>
    `;
  }
}

export default ChatBotButton;
