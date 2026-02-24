import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { MessageTypeRegistry, type MessageSender, type MessageAction } from "@chativa/core";

/**
 * Buttons message component.
 * Renders a bot text bubble followed by a vertical list of full-width action buttons.
 *
 * Default (one-time) mode — `data.persistent` omitted or false:
 *   Once a button is tapped, the list is replaced by "✓ Selected label".
 *   Further clicks are ignored.
 *
 * Persistent mode — `data.persistent: true`:
 *   Buttons remain visible after selection. The chosen button is highlighted.
 *   The user can re-click another button to change their selection.
 *
 * Register a message of type "buttons" with:
 *   {
 *     text?: "Please choose an option:",
 *     persistent?: true,                       // optional — default false
 *     buttons: [{ label: "Option A" }, { label: "Option B", value: "/b" }]
 *   }
 */
@customElement("buttons-message")
export class ButtonsMessage extends LitElement {
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
      gap: 6px;
    }

    .bubble {
      padding: 9px 13px;
      font-size: 0.875rem;
      line-height: 1.5;
      word-break: break-word;
      background: #f1f5f9;
      color: #0f172a;
      border-radius: 4px 16px 16px 16px;
    }

    .btn-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 220px;
    }

    .action-btn {
      width: 100%;
      padding: 9px 14px;
      background: #ffffff;
      border: 1.5px solid var(--chativa-primary-color, #4f46e5);
      border-radius: 10px;
      color: var(--chativa-primary-color, #4f46e5);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      text-align: center;
      font-family: inherit;
      transition: background 0.15s, color 0.15s, opacity 0.15s;
    }

    .action-btn:hover:not(:disabled) {
      background: var(--chativa-primary-color, #4f46e5);
      color: #ffffff;
    }

    .action-btn:active:not(:disabled) {
      opacity: 0.85;
    }

    /* Persistent mode — selected state */
    .action-btn.selected {
      background: var(--chativa-primary-color, #4f46e5);
      color: #ffffff;
    }

    /* Persistent mode — unselected but locked (after another is picked) */
    .action-btn.unselected {
      opacity: 0.45;
      cursor: default;
    }

    .selected-label {
      font-size: 0.8125rem;
      color: #64748b;
      padding: 2px 4px;
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

  @state() private _selected: string | null = null;

  private get _persistent(): boolean {
    return Boolean(this.messageData?.persistent);
  }

  private get _time(): string {
    if (!this.timestamp) return "";
    return new Date(this.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private _onButtonClick(action: MessageAction) {
    if (this._persistent) {
      // Allow re-selection; deselect if same button clicked again
      if (this._selected === action.label) {
        this._selected = null;
        return;
      }
      this._selected = action.label;
    } else {
      // One-time mode: lock after first click
      if (this._selected !== null) return;
      this._selected = action.label;
    }

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
    const text = this.messageData?.text ? String(this.messageData.text) : null;
    const buttons = (this.messageData?.buttons ?? []) as MessageAction[];
    const persistent = this._persistent;

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
          ${text ? html`<div class="bubble">${text}</div>` : nothing}

          ${!persistent && this._selected !== null
            /* One-time mode: replace buttons with confirmation label */
            ? html`<span class="selected-label">✓ ${this._selected}</span>`
            /* Persistent mode or pre-selection: show full button list */
            : html`
                <div class="btn-list">
                  ${buttons.map((btn) => {
                    const isSelected = this._selected === btn.label;
                    const isOther = persistent && this._selected !== null && !isSelected;
                    return html`
                      <button
                        class="action-btn ${isSelected ? "selected" : ""} ${isOther ? "unselected" : ""}"
                        type="button"
                        ?disabled=${isOther}
                        @click=${() => this._onButtonClick(btn)}
                      >${btn.label}</button>
                    `;
                  })}
                </div>
              `}

          ${this._time ? html`<span class="time">${this._time}</span>` : nothing}
        </div>
      </div>
    `;
  }
}

MessageTypeRegistry.register(
  "buttons",
  ButtonsMessage as unknown as typeof HTMLElement
);

export default ButtonsMessage;
