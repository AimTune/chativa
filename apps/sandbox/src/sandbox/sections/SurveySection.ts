import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  chatStore,
  messageStore,
  type EndOfConversationSurveyConfig,
  type ThemeConfig,
} from "@chativa/core";
import { sectionStyles } from "../sandboxShared";

@customElement("sandbox-survey-section")
export class SurveySection extends LitElement {
  static override styles = [
    sectionStyles,
    css`
      .row { display: flex; align-items: center; gap: 8px; }
      .row + .row { margin-top: 8px; }

      input[type="number"] {
        width: 72px;
        padding: 6px 8px;
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

      input[type="text"] {
        flex: 1;
        min-width: 0;
        padding: 6px 8px;
        border-radius: 8px;
        border: 1.5px solid #e2e8f0;
        background: #f8fafc;
        font-size: 0.8125rem;
        color: #0f172a;
        font-family: inherit;
      }
      input[type="text"]:focus {
        outline: none;
        border-color: #c4b5fd;
        background: white;
      }

      .row-label {
        flex: 1;
        font-size: 0.8125rem;
        color: #475569;
      }

      .hint {
        font-size: 0.6875rem;
        color: #94a3b8;
        margin-top: 4px;
      }
    `,
  ];

  @state() private _open = false;
  @state() private _theme: ThemeConfig = chatStore.getState().theme;
  private _unsub!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = chatStore.subscribe(() => {
      this._theme = chatStore.getState().theme;
    });
  }

  disconnectedCallback() {
    this._unsub?.();
    super.disconnectedCallback();
  }

  private get _cfg(): EndOfConversationSurveyConfig {
    return this._theme.endOfConversationSurvey ?? {};
  }

  private _patch(patch: Partial<EndOfConversationSurveyConfig>) {
    chatStore.getState().setTheme({
      endOfConversationSurvey: { ...this._cfg, ...patch },
    });
  }

  private _showNow = () => {
    if (!this._cfg.enabled) return;
    if (!chatStore.getState().isOpened) chatStore.getState().toggle();
    const widget = document.querySelector("chat-iva");
    widget?.dispatchEvent(
      new CustomEvent("chat-close-requested", { bubbles: true, composed: true }),
    );
  };

  private _resetState = () => {
    // Remove any previously injected survey message and dispatch the reset
    // event so ChatWidget clears its session flags.
    const msgs = messageStore.getState().messages;
    for (const m of msgs) {
      if (m.type === "end-of-conversation-survey") {
        messageStore.getState().removeById(m.id);
      }
    }
    const widget = document.querySelector("chat-iva");
    widget?.dispatchEvent(
      new CustomEvent("chat-reset-survey-state", { bubbles: true, composed: true }),
    );
  };

  render() {
    const cfg = this._cfg;
    const enabled = cfg.enabled === true;
    const mode = cfg.mode ?? "inline";
    const maxRating = cfg.maxRating ?? 5;
    const requireBelow = cfg.requireCommentBelow ?? 3;
    const kind = cfg.kind ?? 1;

    return html`
      <div class="section-header" @click=${() => (this._open = !this._open)}>
        <span class="section-label">End-of-Conversation Survey</span>
        <svg class="chevron ${this._open ? "open" : ""}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      ${this._open ? html`
        <div class="section-body" style="display:flex;flex-direction:column;gap:10px">

          <!-- Enabled -->
          <div>
            <div class="sub-label">Enabled</div>
            <div class="toggle-group">
              <button class="tg-btn ${enabled ? "active" : ""}"
                @click=${() => this._patch({ enabled: true })}>On</button>
              <button class="tg-btn ${!enabled ? "active" : ""}"
                @click=${() => this._patch({ enabled: false })}>Off</button>
            </div>
          </div>

          <!-- Mode -->
          <div>
            <div class="sub-label">Mode</div>
            <div class="toggle-group">
              <button class="tg-btn ${mode === "inline" ? "active" : ""}"
                ?disabled=${!enabled}
                @click=${() => this._patch({ mode: "inline" })}>Inline</button>
              <button class="tg-btn ${mode === "screen" ? "active" : ""}"
                ?disabled=${!enabled}
                @click=${() => this._patch({ mode: "screen" })}>Screen</button>
            </div>
          </div>

          <!-- Max rating -->
          <div>
            <div class="sub-label">Max rating</div>
            <div class="row">
              <input
                type="number"
                min="1"
                max="10"
                step="1"
                .value=${String(maxRating)}
                ?disabled=${!enabled}
                @input=${(e: Event) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  if (Number.isFinite(v) && v >= 1 && v <= 10) this._patch({ maxRating: v });
                }}
              />
              <span class="row-label">stars</span>
            </div>
          </div>

          <!-- Require comment below -->
          <div>
            <div class="sub-label">Require comment when rating ≤</div>
            <div class="row">
              <input
                type="number"
                min="0"
                max=${maxRating}
                step="1"
                .value=${String(requireBelow)}
                ?disabled=${!enabled}
                @input=${(e: Event) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  if (Number.isFinite(v) && v >= 0 && v <= maxRating) this._patch({ requireCommentBelow: v });
                }}
              />
              <span class="row-label">0 disables</span>
            </div>
          </div>

          <!-- Kind -->
          <div>
            <div class="sub-label">Kind (sent as payload.kind)</div>
            <div class="row">
              <input
                type="text"
                .value=${String(kind)}
                ?disabled=${!enabled}
                @input=${(e: Event) => {
                  const raw = (e.target as HTMLInputElement).value;
                  const num = Number(raw);
                  this._patch({ kind: raw !== "" && Number.isFinite(num) ? num : raw });
                }}
              />
            </div>
            <div class="hint">Numbers become numeric; strings pass through.</div>
          </div>

          <div class="actions">
            <button class="btn btn-primary" ?disabled=${!enabled} @click=${this._showNow}>
              Show now
            </button>
            <button class="btn btn-ghost" @click=${this._resetState}>
              Reset state
            </button>
          </div>

          <div class="hint">
            "Show now" simulates the close button. "Reset state" clears the session
            flag and any injected inline survey message so you can trigger it again.
          </div>

        </div>
      ` : nothing}
    `;
  }
}
