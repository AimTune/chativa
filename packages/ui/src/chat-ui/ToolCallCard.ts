import { LitElement, html, css, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t, chatStore, EventBus } from "@chativa/core";
import "../i18n/i18n";
import type { ToolCall } from "@chativa/core";
import { copyText } from "../utils/clipboard";

type ToolCallPart = "params" | "result" | "error";

const COPIED_MS = 1500;

/**
 * <tool-call-card> — a single tool invocation.
 *
 * Collapsed: one row with the tool name, a status chip
 * (running / completed / error) and a chevron. Expanded: the invocation
 * parameters plus the result or error payload, each with a copy button.
 * Errors expand automatically so failures are visible at a glance.
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
      text-align: start;
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

    .description {
      color: #475569;
      font-size: 0.75rem;
      line-height: 1.4;
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
      margin-inline-start: auto;
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

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }

    .section-label {
      font-size: 0.62rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #94a3b8;
    }

    .copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 6px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: none;
      color: #94a3b8;
      font: inherit;
      font-size: 0.65rem;
      cursor: pointer;
    }

    .copy-btn:hover,
    .copy-btn:focus-visible {
      border-color: #e2e8f0;
      background: #f8fafc;
      color: #64748b;
    }

    .copy-btn.copied {
      color: var(--chativa-success-color, #16a34a);
    }

    .copy-btn svg {
      width: 12px;
      height: 12px;
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
  /** The section whose "Copied" confirmation is showing. */
  @state() private _copied: ToolCallPart | null = null;
  private _copiedTimer: ReturnType<typeof setTimeout> | null = null;

  override disconnectedCallback(): void {
    if (this._copiedTimer !== null) clearTimeout(this._copiedTimer);
    super.disconnectedCallback();
  }

  private async _copy(part: ToolCallPart, text: string) {
    const tc = this.toolCall;
    if (!tc || !(await copyText(text))) return;
    EventBus.emit("tool_call_copied", { toolCallId: tc.id, part });
    this._copied = part;
    if (this._copiedTimer !== null) clearTimeout(this._copiedTimer);
    this._copiedTimer = setTimeout(() => {
      this._copiedTimer = null;
      this._copied = null;
    }, COPIED_MS);
  }

  /** Section heading with an optional copy button at its inline end. */
  private _renderSectionHead(part: ToolCallPart, label: string, text: string) {
    // Same switch as the code-block copy buttons in text messages.
    const copyable = chatStore.getState().theme.messageActions?.codeBlockCopy !== false;
    const copied = this._copied === part;
    const buttonLabel = copied ? t("message.copied") : `${t("message.copy")}: ${label}`;
    return html`
      <div class="section-head">
        <div class="section-label">${label}</div>
        ${copyable
          ? html`<button
              type="button"
              class="copy-btn ${copied ? "copied" : ""}"
              data-part=${part}
              aria-label=${buttonLabel}
              title=${buttonLabel}
              @click=${() => this._copy(part, text)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                ${copied
                  ? svg`<path d="M5 12.5l4.5 4.5L19 7.5"/>`
                  : svg`<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>`}
              </svg>
              <span>${copied ? t("message.copied") : t("message.copy")}</span>
            </button>`
          : nothing}
      </div>
    `;
  }
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
          <span class="name" dir="auto" title=${tc.description ? `${tc.name} — ${tc.description}` : tc.name}>${tc.name}</span>
          ${this._renderChip(tc)}
          <svg class="chevron ${this._expanded ? "open" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        ${this._expanded
          ? html`
              <div class="body">
                ${tc.description
                  ? html`<div class="description" dir="auto">${tc.description}</div>`
                  : nothing}
                ${hasParams
                  ? html`<div>
                      ${this._renderSectionHead("params", t("toolCalls.parameters"), this._pretty(tc.params))}
                      <pre>${this._pretty(tc.params)}</pre>
                    </div>`
                  : nothing}
                ${hasResult
                  ? html`<div>
                      ${this._renderSectionHead("result", t("toolCalls.result"), this._pretty(tc.result))}
                      <pre>${this._pretty(tc.result)}</pre>
                    </div>`
                  : nothing}
                ${hasError
                  ? html`<div>
                      ${this._renderSectionHead("error", t("toolCalls.error"), String(tc.error))}
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
