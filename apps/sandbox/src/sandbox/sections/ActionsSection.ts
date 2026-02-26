import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { chatStore, DEFAULT_THEME } from "@chativa/core";
import { sectionStyles } from "../sandboxShared";

@customElement("sandbox-actions-section")
export class ActionsSection extends LitElement {
  static override styles = [
    sectionStyles,
    css`
      .status-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 0.75rem;
        color: #64748b;
        padding: 2px 0 6px;
      }
      .dot {
        width: 7px; height: 7px; border-radius: 50%;
        flex-shrink: 0;
      }
      .dot.open   { background: #4ade80; }
      .dot.closed { background: #94a3b8; }
    `,
  ];

  @state() private _open = true;
  @state() private _chatOpen = chatStore.getState().isOpened;
  @state() private _isFullscreen = chatStore.getState().isFullscreen;
  private _unsub!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = chatStore.subscribe(() => {
      const s = chatStore.getState();
      this._chatOpen = s.isOpened;
      this._isFullscreen = s.isFullscreen;
    });
  }

  disconnectedCallback() { this._unsub?.(); super.disconnectedCallback(); }

  render() {
    return html`
      <div class="section-header" @click=${() => (this._open = !this._open)}>
        <span class="section-label">Actions</span>
        <svg class="chevron ${this._open ? "open" : ""}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      ${this._open ? html`
        <div class="section-body" style="display:flex;flex-direction:column;gap:8px">

          <div class="status-row">
            <span class="dot ${this._chatOpen ? "open" : "closed"}"></span>
            Chat is ${this._chatOpen ? "open" : "closed"}
          </div>

          <div class="actions">
            <button class="btn btn-primary" @click=${() => chatStore.getState().toggle()}>
              ${this._chatOpen ? "Close Chat" : "Open Chat"}
            </button>
            <button
              class="btn ${this._isFullscreen ? "btn-primary" : "btn-ghost"}"
              @click=${() => chatStore.getState().toggleFullscreen()}
              title="Toggle fullscreen"
            >⛶ ${this._isFullscreen ? "Exit" : "Full"}</button>
          </div>

          <div class="actions">
            <button class="btn btn-ghost" style="flex:1"
              @click=${() => chatStore.getState().setTheme(DEFAULT_THEME)}
              title="Reset to defaults"
            >Reset</button>
          </div>

        </div>
      ` : nothing}
    `;
  }
}
