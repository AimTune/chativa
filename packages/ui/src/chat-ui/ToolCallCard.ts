import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "i18next";
import "../i18n/i18n";
import type { ToolCall } from "@chativa/core";

/**
 * <tool-call-card> — a single tool invocation.
 *
 * Collapsed: one row with the tool name, a status chip
 * (running / completed / error) and a chevron. Expanded: the invocation
 * parameters plus the result or error payload. Errors expand automatically
 * so failures are visible at a glance.
 */
@customElement("tool-call-card")
export class ToolCallCard extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #ffffff;
      overflow: hidden;
    }

    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 10px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.78rem;
      color: #1e293b;
      text-align: left;
    }

    .head:hover {
      background: #f8fafc;
    }

    .tool-icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      color: #64748b;
    }

    .name {
      font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid #e2e8f0;
      font-size: 0.68rem;
      font-weight: 500;
      flex-shrink: 0;
      margin-left: auto;
    }

    .chip.running {
      color: #475569;
    }

    .chip.completed {
      color: #15803d;
      border-color: #bbf7d0;
      background: #f0fdf4;
    }

    .chip.error {
      color: #b91c1c;
      border-color: #fecaca;
      background: #fef2f2;
    }

    .chip svg {
      width: 11px;
      height: 11px;
    }

    .spinner {
      width: 10px;
      height: 10px;
      border: 2px solid #e2e8f0;
      border-top-color: #64748b;
      border-radius: 50%;
      animation: tool-card-spin 0.8s linear infinite;
    }

    @keyframes tool-card-spin {
      to { transform: rotate(360deg); }
    }

    .chevron {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      color: #94a3b8;
      transition: transform 0.15s;
    }

    .chevron.open {
      transform: rotate(180deg);
    }

    .body {
      padding: 0 10px 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .section-label {
      font-size: 0.62rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 4px;
    }

    pre {
      margin: 0;
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      font-size: 0.7rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: #334155;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 200px;
      overflow: auto;
    }

    .error-box {
      padding: 8px 10px;
      border: 1px solid #fecaca;
      border-radius: 8px;
      background: #fef2f2;
      font-size: 0.72rem;
      color: #b91c1c;
      word-break: break-word;
    }
  `;

  @property({ type: Object }) toolCall: ToolCall | null = null;

  @state() private _expanded = false;
  /** Once the user toggles manually, stop auto-expanding on error. */
  private _userToggled = false;
  private _autoExpandedFor: string | null = null;

  protected override willUpdate(): void {
    const tc = this.toolCall;
    // Auto-expand failures once per invocation so errors are never hidden.
    if (tc && tc.status === "error" && !this._userToggled && this._autoExpandedFor !== tc.id) {
      this._autoExpandedFor = tc.id;
      this._expanded = true;
    }
  }

  private _toggle(): void {
    this._userToggled = true;
    this._expanded = !this._expanded;
  }

  private _renderChip(tc: ToolCall) {
    if (tc.status === "running") {
      return html`<span class="chip running"><span class="spinner"></span>${t("toolCalls.running")}</span>`;
    }
    if (tc.status === "error") {
      return html`<span class="chip error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
        ${t("toolCalls.error")}
      </span>`;
    }
    return html`<span class="chip completed">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" stroke-width="2"/><path d="M8.5 12.2l2.3 2.3 4.7-4.8"/></svg>
      ${t("toolCalls.completed")}
    </span>`;
  }

  private _pretty(value: unknown): string {
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  render() {
    const tc = this.toolCall;
    if (!tc) return nothing;

    // `params` comes straight off the wire — guard against null and
    // non-object values, not just undefined (Object.keys(null) throws).
    const hasParams =
      tc.params != null &&
      typeof tc.params === "object" &&
      Object.keys(tc.params).length > 0;
    const hasResult = tc.status === "completed" && tc.result !== undefined;
    const hasError = tc.status === "error" && !!tc.error;

    return html`
      <div class="card">
        <button
          class="head"
          @click=${this._toggle}
          aria-expanded=${this._expanded}
          aria-label="${tc.name} — ${t(`toolCalls.${tc.status}`)}"
        >
          <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          <span class="name">${tc.name}</span>
          ${this._renderChip(tc)}
          <svg class="chevron ${this._expanded ? "open" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        ${this._expanded
          ? html`
              <div class="body">
                ${hasParams
                  ? html`<div>
                      <div class="section-label">${t("toolCalls.parameters")}</div>
                      <pre>${this._pretty(tc.params)}</pre>
                    </div>`
                  : nothing}
                ${hasResult
                  ? html`<div>
                      <div class="section-label">${t("toolCalls.result")}</div>
                      <pre>${this._pretty(tc.result)}</pre>
                    </div>`
                  : nothing}
                ${hasError
                  ? html`<div>
                      <div class="section-label">${t("toolCalls.error")}</div>
                      <div class="error-box">${tc.error}</div>
                    </div>`
                  : nothing}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
