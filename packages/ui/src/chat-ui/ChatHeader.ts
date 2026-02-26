import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
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
      cursor: grab;
      user-select: none;
    }

    .header:active {
      cursor: grabbing;
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
      pointer-events: none;
    }

    .avatar svg {
      width: 22px;
      height: 22px;
      color: white;
    }

    .info {
      flex: 1;
      min-width: 0;
      pointer-events: none;
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
      transition: background 0.3s ease;
    }

    .status-dot.connecting {
      background: #fbbf24;
      animation: pulse 1.2s ease-in-out infinite;
    }

    .status-dot.error {
      background: #f87171;
    }

    .status-dot.disconnected {
      background: #94a3b8;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.45; transform: scale(0.75); }
    }

    .status-text {
      color: rgba(255, 255, 255, 0.75);
      font-size: 0.75rem;
      font-weight: 400;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .icon-btn {
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

    .icon-btn:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .icon-btn svg {
      width: 15px;
      height: 15px;
    }

    .icon-btn.active {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Search bar */
    .search-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
    }

    .search-input {
      flex: 1;
      min-width: 0;
      padding: 6px 10px;
      border: 1.5px solid rgba(255, 255, 255, 0.4);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.15);
      color: white;
      font-size: 0.875rem;
      font-family: inherit;
      outline: none;
    }

    .search-input::placeholder {
      color: rgba(255, 255, 255, 0.6);
    }

    .search-input:focus {
      border-color: rgba(255, 255, 255, 0.8);
      background: rgba(255, 255, 255, 0.22);
    }
  `;

  /**
   * When true, show a "conversations" icon button in the header actions area.
   * The button dispatches a `show-conversations` event (bubbles, composed).
   * Set by `ChatWidget` when `theme.enableMultiConversation` is on.
   */
  @property({ type: Boolean, attribute: "show-conv-toggle" }) showConvToggle = false;

  @state() private _searchOpen = false;

  private get _statusLabel(): string {
    switch (this.themeState.connectorStatus) {
      case "connecting": return t("header.status.connecting");
      case "connected": return t("header.status.connected");
      case "error": return t("header.status.error");
      case "disconnected": return t("header.status.disconnected");
      default: return t("header.status.offline");
    }
  }

  private _onHeaderMouseDown(e: MouseEvent) {
    if ((e.target as Element).closest(".actions, .search-bar")) return;
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent("chat-drag-start", {
        detail: { clientX: e.clientX, clientY: e.clientY },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onHeaderTouchStart(e: TouchEvent) {
    if ((e.target as Element).closest(".actions, .search-bar")) return;
    const touch = e.touches[0];
    this.dispatchEvent(
      new CustomEvent("chat-drag-start", {
        detail: { clientX: touch.clientX, clientY: touch.clientY },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onConvToggle() {
    this.dispatchEvent(
      new CustomEvent("show-conversations", { bubbles: true, composed: true })
    );
  }

  private _toggleSearch() {
    this._searchOpen = !this._searchOpen;
    if (!this._searchOpen) {
      this.themeState.clearSearch();
    } else {
      this.updateComplete.then(() => {
        this.shadowRoot?.querySelector<HTMLInputElement>(".search-input")?.focus();
      });
    }
  }

  private _onSearchInput(e: Event) {
    this.themeState.setSearchQuery((e.target as HTMLInputElement).value);
  }

  private _onSearchKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") this._toggleSearch();
  }

  render() {
    const { connectorStatus, isFullscreen, allowFullscreen, theme } = this.themeState;
    const enableSearch = theme.enableSearch !== false;
    return html`
      <div
        class="header"
        @mousedown=${this._onHeaderMouseDown}
        @touchstart=${this._onHeaderTouchStart}
      >
        ${this.showConvToggle && !this._searchOpen ? html`
          <button
            class="icon-btn"
            @click=${this._onConvToggle}
            aria-label="Back to conversations"
            title="Back to conversations"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
        ` : nothing}

        ${this._searchOpen ? nothing : html`
          <div class="avatar">
            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="8" width="14" height="12" rx="2.5" />
              <circle cx="9.5" cy="13" r="1.5" fill="white" />
              <circle cx="14.5" cy="13" r="1.5" fill="white" />
              <path d="M9.5 17c.5.5 1.4.8 2.5.8s2-.3 2.5-.8" stroke="white" stroke-width="1.2" stroke-linecap="round" fill="none" />
              <path d="M12 5v3" stroke="white" stroke-width="1.5" stroke-linecap="round" />
              <circle cx="12" cy="4" r="1.5" fill="white" />
            </svg>
          </div>
          <div class="info">
            <span class="title">${t("header.title")}</span>
            <div class="status">
              <span class="status-dot ${connectorStatus}"></span>
              <span class="status-text">${this._statusLabel}</span>
            </div>
          </div>
        `}

        ${enableSearch && this._searchOpen ? html`
          <div class="search-bar">
            <input
              class="search-input"
              type="search"
              placeholder=${t("header.search.placeholder")}
              @input=${this._onSearchInput}
              @keydown=${this._onSearchKeydown}
              autocomplete="off"
            />
          </div>
        ` : nothing}

        <div class="actions">
          ${enableSearch ? html`
            <button
              class="icon-btn ${this._searchOpen ? "active" : ""}"
              @click=${this._toggleSearch}
              aria-label=${t("header.search.toggle")}
              title=${t("header.search.toggle")}
            >
              ${this._searchOpen
                ? html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" /></svg>`
                : html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>`}
            </button>
          ` : nothing}

          ${allowFullscreen ? html`
            <button
              class="icon-btn"
              @click=${() => this.themeState.toggleFullscreen()}
              aria-label="${isFullscreen ? t("header.fullscreen.exit") : t("header.fullscreen.enter")}"
              title="${isFullscreen ? t("header.fullscreen.exit") : t("header.fullscreen.enter")}"
            >
              ${isFullscreen
                ? html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></svg>`
                : html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>`}
            </button>
          ` : nothing}

          <button
            class="icon-btn"
            @click=${() => this.themeState.close()}
            aria-label="${t("header.close")}"
            title="${t("header.close")}"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    `;
  }
}

export default ChatHeader;
