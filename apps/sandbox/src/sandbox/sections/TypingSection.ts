import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { chatStore } from "@chativa/core";
import { sectionStyles } from "../sandboxShared";

@customElement("sandbox-typing-section")
export class TypingSection extends LitElement {
  static override styles = [
    sectionStyles,
    css`
      .row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .row + .row { margin-top: 8px; }

      label.inline {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8125rem;
        color: #475569;
        cursor: pointer;
        user-select: none;
      }

      input[type="number"] {
        flex: 1;
        min-width: 0;
        padding: 7px 9px;
        border-radius: 8px;
        border: 1.5px solid #e2e8f0;
        background: #f8fafc;
        font-size: 0.8125rem;
        color: #0f172a;
        font-family: inherit;
      }
      input[type="number"]:focus {
        outline: none;
        border-color: #c4b5fd;
        background: white;
      }
      input[type="number"]:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .unit {
        font-size: 0.75rem;
        color: #94a3b8;
      }

      .status {
        font-size: 0.75rem;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .dot {
        width: 7px; height: 7px; border-radius: 50%;
        flex-shrink: 0;
      }
      .dot.on  { background: #4ade80; }
      .dot.off { background: #94a3b8; }
    `,
  ];

  @state() private _open = true;
  @state() private _durationMs = 3000;
  @state() private _untilMessage = false;
  @state() private _isTyping = chatStore.getState().isTyping;
  private _unsub!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = chatStore.subscribe(() => {
      this._isTyping = chatStore.getState().isTyping;
    });
  }

  disconnectedCallback() {
    this._unsub?.();
    super.disconnectedCallback();
  }

  private _start = () => {
    const opts = this._untilMessage
      ? { untilMessage: true }
      : { durationMs: this._durationMs };
    chatStore.getState().setTyping(true, opts);
  };

  private _extend = () => {
    // Re-apply same opts — duration timer resets; untilMessage stays on.
    this._start();
  };

  private _stop = () => {
    chatStore.getState().setTyping(false);
  };

  render() {
    return html`
      <div class="section-header" @click=${() => (this._open = !this._open)}>
        <span class="section-label">Typing</span>
        <svg class="chevron ${this._open ? "open" : ""}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      ${this._open ? html`
        <div class="section-body">

          <div class="status">
            <span class="dot ${this._isTyping ? "on" : "off"}"></span>
            Indicator is ${this._isTyping ? "on" : "off"}
          </div>

          <div class="row" style="margin-top:10px">
            <input
              type="number"
              min="100"
              step="100"
              .value=${String(this._durationMs)}
              ?disabled=${this._untilMessage}
              @input=${(e: Event) => {
                const v = Number((e.target as HTMLInputElement).value);
                if (Number.isFinite(v) && v > 0) this._durationMs = v;
              }}
            />
            <span class="unit">ms</span>
          </div>

          <div class="row">
            <label class="inline">
              <input
                type="checkbox"
                .checked=${this._untilMessage}
                @change=${(e: Event) => {
                  this._untilMessage = (e.target as HTMLInputElement).checked;
                }}
              />
              Until next message
            </label>
          </div>

          <div class="actions" style="margin-top:10px">
            <button class="btn btn-primary" @click=${this._start}>Start</button>
            <button
              class="btn btn-ghost"
              ?disabled=${!this._isTyping}
              @click=${this._extend}
              title="Re-apply to reset the timer"
            >Extend</button>
            <button
              class="btn btn-ghost"
              ?disabled=${!this._isTyping}
              @click=${this._stop}
            >Stop</button>
          </div>

        </div>
      ` : nothing}
    `;
  }
}
