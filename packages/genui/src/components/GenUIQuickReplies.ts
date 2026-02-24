import { html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";

export interface GenUIQuickReplyItem {
  label: string;
  value: string;
}

/**
 * `<genui-quick-replies>` — built-in horizontally scrollable quick-reply buttons.
 *
 * Expected props from connector:
 * ```json
 * {
 *   "label": "Choose an option:",
 *   "items": [
 *     { "label": "Pricing", "value": "show_pricing" },
 *     { "label": "Contact us", "value": "contact" }
 *   ]
 * }
 * ```
 *
 * Clicking a button dispatches a `chat-action` CustomEvent (bubbles + composed)
 * compatible with the existing Chativa action pipeline, and disables the row.
 */
@customElement("genui-quick-replies")
export class GenUIQuickReplies extends ChativaElement {
  static override styles = css`
    :host { display: block; }

    .label {
      font-size: 0.8125rem;
      color: #64748b;
      margin: 0 0 8px;
      font-family: inherit;
    }

    .buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .reply-btn {
      padding: 7px 16px;
      border: 1.5px solid var(--chativa-primary-color, #4f46e5);
      border-radius: 999px;
      background: transparent;
      color: var(--chativa-primary-color, #4f46e5);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, color 0.15s, opacity 0.15s;
      white-space: nowrap;
    }

    .reply-btn:hover:not(:disabled) {
      background: var(--chativa-primary-color, #4f46e5);
      color: #ffffff;
    }

    .reply-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .reply-btn--selected {
      background: var(--chativa-primary-color, #4f46e5);
      color: #ffffff;
      opacity: 1 !important;
    }
  `;

  @property({ type: String }) label = "";
  @property({ type: Array }) items: GenUIQuickReplyItem[] = [];

  @state() private _selectedValue = "";

  private _onSelect(item: GenUIQuickReplyItem) {
    if (this._selectedValue) return;
    this._selectedValue = item.value;
    this.dispatchEvent(
      new CustomEvent<string>("chat-action", {
        detail: item.value,
        bubbles: true,
        composed: true,
      })
    );
  }

  override render() {
    const disabled = Boolean(this._selectedValue);
    return html`
      ${this.label ? html`<p class="label">${this.label}</p>` : nothing}
      <div class="buttons" role="list">
        ${this.items.map((item) => html`
          <button
            class="reply-btn ${this._selectedValue === item.value ? "reply-btn--selected" : ""}"
            type="button"
            role="listitem"
            ?disabled=${disabled}
            @click=${() => this._onSelect(item)}
          >${item.label}</button>
        `)}
      </div>
    `;
  }
}
