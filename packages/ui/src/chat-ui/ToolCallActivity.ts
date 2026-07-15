import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "i18next";
import "../i18n/i18n";
import type { ToolCall } from "@chativa/core";
import "./ToolCallCard";

/**
 * <tool-call-activity> — one-line tool activity strip, expandable to the
 * full invocation trace.
 *
 * Two modes:
 * - `live` — rendered by the message list while the bot is still working.
 *   The line shows the currently running tool's description (or name) with
 *   a spinner.
 * - attached (default) — rendered right above a bot message that carries a
 *   `data.toolCalls` trace. The line shows a compact summary
 *   ("N operations · M failed").
 *
 * Clicking the line toggles the full list of <tool-call-card>s.
 */
@customElement("tool-call-activity")
export class ToolCallActivity extends LitElement {
  static override styles = css`
    :host {
      display: block;
      max-width: 340px;
    }

    .line {
      display: flex;
      align-items: center;
      gap: 7px;
      width: 100%;
      padding: 5px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      background: #f8fafc;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.72rem;
      color: #475569;
      text-align: left;
    }

    .line:hover {
      background: #f1f5f9;
    }

    .line-icon {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
      color: #64748b;
    }

    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .count-error {
      color: #b91c1c;
      font-weight: 600;
      flex-shrink: 0;
    }

    .spinner {
      width: 11px;
      height: 11px;
      flex-shrink: 0;
      border: 2px solid #e2e8f0;
      border-top-color: #4f46e5;
      border-radius: 50%;
      animation: tool-activity-spin 0.8s linear infinite;
    }

    @keyframes tool-activity-spin {
      to { transform: rotate(360deg); }
    }

    .chevron {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
      margin-left: auto;
      color: #94a3b8;
      transition: transform 0.15s;
    }

    .chevron.open {
      transform: rotate(180deg);
    }

    .trace {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
    }
  `;

  @property({ type: Array }) toolCalls: ToolCall[] = [];
  /** Live mode — the bot is still working; show the current tool + spinner. */
  @property({ type: Boolean }) live = false;

  @state() private _expanded = false;

  private _toggle(): void {
    this._expanded = !this._expanded;
  }

  private _lineContent() {
    const calls = this.toolCalls;
    const running = [...calls].reverse().find((tc) => tc.status === "running");
    const errorCount = calls.filter((tc) => tc.status === "error").length;

    if (this.live && running) {
      return html`
        <span class="spinner" aria-hidden="true"></span>
        <span class="label">${running.description ?? running.name}</span>
      `;
    }

    return html`
      <svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
      <span class="label">${t("toolCalls.summary", { count: calls.length })}</span>
      ${errorCount > 0
        ? html`<span class="count-error">${t("toolCalls.failed", { count: errorCount })}</span>`
        : nothing}
    `;
  }

  render() {
    if (this.toolCalls.length === 0) return nothing;

    return html`
      <button
        class="line"
        @click=${this._toggle}
        aria-expanded=${this._expanded}
        aria-label="${t("toolCalls.ariaToggle")}"
      >
        ${this._lineContent()}
        <svg class="chevron ${this._expanded ? "open" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      ${this._expanded
        ? html`
            <div class="trace">
              ${this.toolCalls.map(
                (tc) => html`<tool-call-card .toolCall=${tc}></tool-call-card>`,
              )}
            </div>
          `
        : nothing}
    `;
  }
}
