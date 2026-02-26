import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "i18next";
import i18next from "../i18n/i18n";
import { chatStore, SlashCommandRegistry, resolveText, type ISlashCommand } from "@chativa/core";
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
      position: relative;
    }

    .input-area.drag-over {
      background: #ede9fe;
      border-top-color: var(--chativa-primary-color, #4f46e5);
    }

    .icon-btn {
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

    .icon-btn:hover {
      color: #64748b;
      background: #f1f5f9;
    }

    .icon-btn.active {
      color: var(--chativa-primary-color, #4f46e5);
      background: #ede9fe;
    }

    .icon-btn svg {
      width: 20px;
      height: 20px;
    }

    .text-input {
      flex: 1;
      min-width: 0;
      min-height: 36px;
      max-height: 120px;
      padding: 8px 14px;
      border: 1.5px solid #e2e8f0;
      border-radius: 18px;
      font-size: 0.875rem;
      line-height: 1.4;
      color: #0f172a;
      background: #f8fafc;
      outline: none;
      font-family: inherit;
      transition: border-color 0.15s, background 0.15s;
      resize: none;
      overflow-y: auto;
      box-sizing: border-box;
      display: block;
    }

    .text-input::placeholder {
      color: #94a3b8;
    }

    .text-input:focus {
      border-color: var(--chativa-primary-color, #4f46e5);
      background: #ffffff;
    }

    .text-input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .input-area.disconnected {
      opacity: 0.6;
      pointer-events: none;
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

    /* Hidden file input */
    .file-input {
      display: none;
    }

    /* File previews */
    .file-previews {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 12px 0;
      background: #ffffff;
    }

    .file-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px 4px 8px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      font-size: 0.75rem;
      color: #374151;
      max-width: 200px;
    }

    .file-chip-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-chip-size {
      color: #94a3b8;
      flex-shrink: 0;
    }

    .file-chip-remove {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      border: none;
      background: none;
      padding: 0;
      cursor: pointer;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.1s, color 0.1s;
    }

    .file-chip-remove:hover {
      background: #e2e8f0;
      color: #374151;
    }

    /* Emoji picker popup */
    .picker-popup {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 8px;
      z-index: 100;
    }

    /* Slash command popup */
    .slash-popup {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 12px;
      right: 12px;
      z-index: 101;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      overflow: hidden;
    }

    .slash-item {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 9px 14px;
      cursor: pointer;
      transition: background 0.1s;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
    }

    .slash-item:hover,
    .slash-item.focused {
      background: #f1f5f9;
    }

    .slash-item-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--chativa-primary-color, #4f46e5);
      white-space: nowrap;
    }

    .slash-item-usage {
      font-size: 0.8125rem;
      color: #94a3b8;
      white-space: nowrap;
    }

    .slash-item-desc {
      font-size: 0.8125rem;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;

  @property({ type: String }) value = "";
  @state() private _pickerOpen = false;
  @state() private _files: File[] = [];
  @state() private _dragOver = false;
  @state() private _slashMatches: ISlashCommand[] = [];
  @state() private _slashFocusIdx = 0;

  private _onLangChange = () => { this.requestUpdate(); };
  private _unsubscribeChatStore!: () => void;

  // ── Text input ────────────────────────────────────────────

  private _onInput(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    this.value = el.value;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    this._updateSlashMatches();
  }

  private _updateSlashMatches() {
    if (this.value.startsWith("/")) {
      const query = this.value.slice(1).toLowerCase();
      this._slashMatches = SlashCommandRegistry.list().filter(
        (cmd) => cmd.name.toLowerCase().startsWith(query)
      );
      this._slashFocusIdx = 0;
    } else {
      this._slashMatches = [];
    }
  }

  private _onKeyDown(e: KeyboardEvent) {
    // Navigate slash popup with arrow keys
    if (this._slashMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this._slashFocusIdx = (this._slashFocusIdx + 1) % this._slashMatches.length;
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this._slashFocusIdx =
          (this._slashFocusIdx - 1 + this._slashMatches.length) % this._slashMatches.length;
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && this._slashMatches.length > 0)) {
        e.preventDefault();
        this._selectSlashCommand(this._slashMatches[this._slashFocusIdx]);
        return;
      }
      if (e.key === "Escape") {
        this._slashMatches = [];
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this._send();
    }
    if (e.key === "Escape" && this._pickerOpen) {
      this._pickerOpen = false;
    }
  }

  private _selectSlashCommand(cmd: ISlashCommand) {
    this.value = `/${cmd.name} `;
    this._slashMatches = [];
    this.updateComplete.then(() => {
      const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>(".text-input");
      if (ta) {
        ta.focus();
        ta.style.height = "auto";
        ta.style.height = `${ta.scrollHeight}px`;
      }
    });
  }

  private _send() {
    const text = this.value.trim();
    const hasFiles = this._files.length > 0;

    // Execute slash command if exact match
    if (text.startsWith("/")) {
      const parts = text.slice(1).split(" ");
      const name = parts[0];
      const args = parts.slice(1).join(" ");
      if (SlashCommandRegistry.execute(name, args)) {
        this.value = "";
        this._slashMatches = [];
        this._resetTextarea();
        return;
      }
    }

    if (hasFiles) {
      this.dispatchEvent(
        new CustomEvent<{ files: File[]; text: string }>("send-file", {
          detail: { files: [...this._files], text },
          bubbles: true,
          composed: true,
        })
      );
      this._files = [];
    }

    if (text && !hasFiles) {
      this.dispatchEvent(
        new CustomEvent<string>("send-message", {
          detail: text,
          bubbles: true,
          composed: true,
        })
      );
    } else if (text && hasFiles) {
      // text sent as part of send-file event — nothing extra needed
    }

    this.value = "";
    this._slashMatches = [];
    this._resetTextarea();
  }

  private _resetTextarea() {
    this.updateComplete.then(() => {
      const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>(".text-input");
      if (ta) ta.style.height = "auto";
    });
  }

  // ── Emoji picker ──────────────────────────────────────────

  private _togglePicker() {
    this._pickerOpen = !this._pickerOpen;
  }

  private _onEmojiSelect(e: CustomEvent<string>) {
    const emoji = e.detail;
    const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>(".text-input");
    if (ta) {
      const start = ta.selectionStart ?? this.value.length;
      const end = ta.selectionEnd ?? this.value.length;
      this.value = this.value.slice(0, start) + emoji + this.value.slice(end);
      this.updateComplete.then(() => {
        const el = this.shadowRoot?.querySelector<HTMLTextAreaElement>(".text-input");
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

  // ── File upload ───────────────────────────────────────────

  private _openFilePicker() {
    this.shadowRoot?.querySelector<HTMLInputElement>(".file-input")?.click();
  }

  private _onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) this._addFiles(Array.from(input.files));
    input.value = "";
  }

  private _addFiles(files: File[]) {
    this._files = [...this._files, ...files];
  }

  /** Public API: add files from an external source (e.g. widget-level drag-drop). */
  addFiles(files: File[]) {
    this._addFiles(files);
  }

  private _removeFile(index: number) {
    this._files = this._files.filter((_, i) => i !== index);
  }

  private _formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private _onDragOver(e: DragEvent) {
    e.preventDefault();
    this._dragOver = true;
  }

  private _onDragLeave() {
    this._dragOver = false;
  }

  private _onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation(); // prevent widget-level handler from double-processing
    this._dragOver = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) this._addFiles(Array.from(files));
  }

  // ── Document click (close popups) ─────────────────────────

  private _onDocumentClick = (e: MouseEvent) => {
    if (!this._pickerOpen && this._slashMatches.length === 0) return;
    const path = e.composedPath();
    if (!path.includes(this)) {
      this._pickerOpen = false;
      this._slashMatches = [];
    }
  };

  // ── Lifecycle ─────────────────────────────────────────────

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._onDocumentClick);
    i18next.on("languageChanged", this._onLangChange);
    this._unsubscribeChatStore = chatStore.subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocumentClick);
    i18next.off("languageChanged", this._onLangChange);
    this._unsubscribeChatStore?.();
    super.disconnectedCallback();
  }

  // ── Render ────────────────────────────────────────────────

  render() {
    const hasText = this.value.trim().length > 0;
    const hasFiles = this._files.length > 0;
    const connected = chatStore.getState().connectorStatus === "connected";

    return html`
      ${this._files.length > 0 ? html`
        <div class="file-previews">
          ${this._files.map((f, i) => html`
            <div class="file-chip">
              <span class="file-chip-name" title=${f.name}>${f.name}</span>
              <span class="file-chip-size">${this._formatSize(f.size)}</span>
              <button
                class="file-chip-remove"
                type="button"
                aria-label="${t("input.removeFile", { name: f.name })}"
                @click=${() => this._removeFile(i)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10">
                  <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          `)}
        </div>
      ` : nothing}

      <div
        class="input-area ${connected ? "" : "disconnected"} ${this._dragOver ? "drag-over" : ""}"
        @dragover=${this._onDragOver}
        @dragleave=${this._onDragLeave}
        @drop=${this._onDrop}
      >
        <!-- File attachment button -->
        <input
          class="file-input"
          type="file"
          multiple
          @change=${this._onFileChange}
        />
        <button
          class="icon-btn ${hasFiles ? "active" : ""}"
          type="button"
          aria-label="${t("input.attachFile")}"
          ?disabled=${!connected}
          @click=${(e: MouseEvent) => { e.stopPropagation(); this._openFilePicker(); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" xmlns="http://www.w3.org/2000/svg">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Emoji button -->
        <button
          class="icon-btn ${this._pickerOpen ? "active" : ""}"
          type="button"
          aria-label="${t("input.emoji")}"
          aria-haspopup="true"
          aria-expanded="${this._pickerOpen}"
          aria-controls="emoji-popup"
          ?disabled=${!connected}
          @click=${(e: MouseEvent) => { e.stopPropagation(); this._togglePicker(); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 13s1.5 2 4 2 4-2 4-2" stroke-linecap="round" />
            <circle cx="9" cy="9.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="9.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </button>

        <textarea
          class="text-input"
          rows="1"
          .value=${this.value}
          @input=${this._onInput}
          @keydown=${this._onKeyDown}
          placeholder="${t("input.placeholder")}"
          aria-label="${t("input.placeholder")}"
          aria-autocomplete="list"
          aria-expanded="${this._slashMatches.length > 0}"
          aria-controls="${this._slashMatches.length > 0 ? "slash-popup" : nothing}"
          aria-owns="${this._slashMatches.length > 0 ? "slash-popup" : nothing}"
          autocomplete="off"
          spellcheck="true"
          ?disabled=${!connected}
        ></textarea>

        <button
          class="send-btn"
          type="button"
          ?disabled=${(!hasText && !hasFiles) || !connected}
          @click=${this._send}
          aria-label="${t("input.send")}"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>

      <!-- Slash command popup -->
      ${this._slashMatches.length > 0 ? html`
        <div class="slash-popup" id="slash-popup" role="listbox">
          ${this._slashMatches.map((cmd, i) => html`
            <button
              class="slash-item ${i === this._slashFocusIdx ? "focused" : ""}"
              type="button"
              role="option"
              aria-selected="${i === this._slashFocusIdx}"
              @click=${() => this._selectSlashCommand(cmd)}
            >
              <span class="slash-item-name">/${cmd.name}</span>
              ${resolveText(cmd.usage) ? html`<span class="slash-item-usage">${resolveText(cmd.usage)}</span>` : nothing}
              <span class="slash-item-desc">${resolveText(cmd.description)}</span>
            </button>
          `)}
        </div>
      ` : nothing}

      <!-- Emoji picker popup -->
      ${this._pickerOpen ? html`
        <div class="picker-popup" id="emoji-popup" @click=${(e: MouseEvent) => e.stopPropagation()}>
          <emoji-picker @emoji-select=${this._onEmojiSelect}></emoji-picker>
        </div>
      ` : nothing}
    `;
  }
}

export default ChatInput;
