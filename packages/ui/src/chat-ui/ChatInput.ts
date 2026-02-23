import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./EmojiPicker";

@customElement("chat-input")
class ChatInput extends LitElement {
  static override styles = css`
    :host {
      display: block;
      flex-shrink: 0;
      position: relative;
    }

    .input-area {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px 12px;
      background: #ffffff;
      border-top: 1px solid #f1f5f9;
    }

    .emoji-btn {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: none;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      flex-shrink: 0;
      padding: 0;
      transition: color 0.15s, background 0.15s;
    }

    .emoji-btn:hover {
      color: #64748b;
      background: #f1f5f9;
    }

    .emoji-btn.active {
      color: var(--chativa-primary-color, #4f46e5);
      background: #ede9fe;
    }

    .emoji-btn svg {
      width: 20px;
      height: 20px;
    }

    .text-input {
      flex: 1;
      min-width: 0;
      height: 36px;
      padding: 0 14px;
      border: 1.5px solid #e2e8f0;
      border-radius: 20px;
      font-size: 0.875rem;
      line-height: 1;
      color: #0f172a;
      background: #f8fafc;
      outline: none;
      font-family: inherit;
      transition: border-color 0.15s, background 0.15s;
    }

    .text-input::placeholder {
      color: #94a3b8;
    }

    .text-input:focus {
      border-color: var(--chativa-primary-color, #4f46e5);
      background: #ffffff;
    }

    .send-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: var(--chativa-primary-color, #4f46e5);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      padding: 0;
      transition: opacity 0.15s, transform 0.15s;
    }

    .send-btn:hover {
      opacity: 0.9;
    }

    .send-btn:active {
      transform: scale(0.92);
    }

    .send-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }

    .send-btn svg {
      width: 18px;
      height: 18px;
    }

    /* Emoji picker popup */
    .picker-popup {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 8px;
      z-index: 100;
    }
  `;

  @property({ type: String }) value = "";
  @state() private _pickerOpen = false;

  private _onInput(e: Event) {
    this.value = (e.target as HTMLInputElement).value;
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this._send();
    }
    if (e.key === "Escape" && this._pickerOpen) {
      this._pickerOpen = false;
    }
  }

  private _send() {
    const text = this.value.trim();
    if (!text) return;
    this.dispatchEvent(
      new CustomEvent<string>("send-message", {
        detail: text,
        bubbles: true,
        composed: true,
      })
    );
    this.value = "";
  }

  private _togglePicker() {
    this._pickerOpen = !this._pickerOpen;
  }

  private _onEmojiSelect(e: CustomEvent<string>) {
    const emoji = e.detail;
    const input = this.shadowRoot?.querySelector<HTMLInputElement>(".text-input");
    if (input) {
      const start = input.selectionStart ?? this.value.length;
      const end = input.selectionEnd ?? this.value.length;
      this.value =
        this.value.slice(0, start) + emoji + this.value.slice(end);
      // Restore focus + cursor after LitElement re-renders
      this.updateComplete.then(() => {
        const el = this.shadowRoot?.querySelector<HTMLInputElement>(".text-input");
        if (el) {
          el.focus();
          const pos = start + emoji.length;
          el.setSelectionRange(pos, pos);
        }
      });
    } else {
      this.value += emoji;
    }
    this._pickerOpen = false;
  }

  private _onHostClick(e: MouseEvent) {
    // Close picker when clicking outside of it
    if (!this._pickerOpen) return;
    const path = e.composedPath();
    const picker = this.shadowRoot?.querySelector("emoji-picker");
    const emojiBtn = this.shadowRoot?.querySelector(".emoji-btn");
    if (picker && !path.includes(picker) && !path.includes(emojiBtn as EventTarget)) {
      this._pickerOpen = false;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._onDocumentClick);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocumentClick);
    super.disconnectedCallback();
  }

  private _onDocumentClick = (e: MouseEvent) => {
    if (!this._pickerOpen) return;
    const path = e.composedPath();
    if (!path.includes(this)) {
      this._pickerOpen = false;
    }
  };

  render() {
    const hasText = this.value.trim().length > 0;
    return html`
      <div class="input-area" @click=${this._onHostClick}>
        <button
          class="emoji-btn ${this._pickerOpen ? "active" : ""}"
          type="button"
          aria-label="Emoji"
          @click=${(e: MouseEvent) => { e.stopPropagation(); this._togglePicker(); }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M8 13s1.5 2 4 2 4-2 4-2" stroke-linecap="round" />
            <circle cx="9" cy="9.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="9.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </button>

        <input
          class="text-input"
          type="text"
          .value=${this.value}
          @input=${this._onInput}
          @keydown=${this._onKeyDown}
          placeholder="Type a message…"
          autocomplete="off"
          spellcheck="true"
        />

        <button
          class="send-btn"
          type="button"
          ?disabled=${!hasText}
          @click=${this._send}
          aria-label="Send message"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>

      ${this._pickerOpen
        ? html`
            <div class="picker-popup" @click=${(e: MouseEvent) => e.stopPropagation()}>
              <emoji-picker @emoji-select=${this._onEmojiSelect}></emoji-picker>
            </div>
          `
        : ""}
    `;
  }
}

export default ChatInput;
