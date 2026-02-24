import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";

export type GenUIAlertVariant = "info" | "success" | "warning" | "error";

/**
 * `<genui-alert>` — built-in alert/notification component for Generative UI streams.
 *
 * Expected props from connector:
 * ```json
 * {
 *   "variant": "info",
 *   "title": "Heads up",
 *   "message": "Your session will expire in 5 minutes."
 * }
 * ```
 * variant: "info" | "success" | "warning" | "error"
 */
@customElement("genui-alert")
export class GenUIAlert extends ChativaElement {
  static override styles = css`
    :host { display: block; }

    .alert {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 14px 16px;
      border-radius: 10px;
      border-left: 4px solid;
      font-family: inherit;
      max-width: 420px;
    }

    .icon {
      font-size: 1.125rem;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .body { flex: 1; min-width: 0; }

    .title {
      margin: 0 0 2px;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .message {
      margin: 0;
      font-size: 0.8125rem;
      line-height: 1.5;
    }

    /* Variants */
    .alert--info    { background: #eff6ff; border-color: #3b82f6; color: #1e40af; }
    .alert--success { background: #f0fdf4; border-color: #22c55e; color: #15803d; }
    .alert--warning { background: #fffbeb; border-color: #f59e0b; color: #92400e; }
    .alert--error   { background: #fef2f2; border-color: #ef4444; color: #991b1b; }
  `;

  @property({ type: String }) variant: GenUIAlertVariant = "info";
  @property({ type: String }) title = "";
  @property({ type: String }) message = "";
  @property({ type: String }) icon = "";

  private _defaultIcon(): string {
    const icons: Record<GenUIAlertVariant, string> = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
    };
    return icons[this.variant] ?? "ℹ️";
  }

  override render() {
    const icon = this.icon || this._defaultIcon();
    return html`
      <div class="alert alert--${this.variant}" role="alert">
        <span class="icon" aria-hidden="true">${icon}</span>
        <div class="body">
          ${this.title ? html`<p class="title">${this.title}</p>` : nothing}
          ${this.message ? html`<p class="message">${this.message}</p>` : nothing}
        </div>
      </div>
    `;
  }
}
