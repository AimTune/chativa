import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";

export type GenUIProgressVariant = "default" | "success" | "warning" | "error";

/**
 * `<genui-progress>` — built-in progress bar component for Generative UI streams.
 *
 * Expected props from connector:
 * ```json
 * {
 *   "label": "Order processing",
 *   "value": 65,
 *   "caption": "3 of 5 steps complete",
 *   "variant": "default"
 * }
 * ```
 * value: 0–100
 * variant: "default" | "success" | "warning" | "error"
 */
@customElement("genui-progress")
export class GenUIProgress extends ChativaElement {
  static override styles = css`
    :host { display: block; }

    .progress-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      max-width: 400px;
      font-family: inherit;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 8px;
    }

    .progress-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #0f172a;
    }

    .progress-value {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #64748b;
    }

    .track {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }

    .bar {
      height: 100%;
      border-radius: 999px;
      transition: width 0.4s ease;
    }

    .bar--default { background: var(--chativa-primary-color, #4f46e5); }
    .bar--success  { background: #22c55e; }
    .bar--warning  { background: #f59e0b; }
    .bar--error    { background: #ef4444; }

    .progress-caption {
      margin-top: 6px;
      font-size: 0.75rem;
      color: #94a3b8;
    }
  `;

  @property({ type: String }) label = "";
  @property({ type: Number }) value = 0;
  @property({ type: String }) caption = "";
  @property({ type: String }) variant: GenUIProgressVariant = "default";

  override render() {
    const clamped = Math.min(100, Math.max(0, this.value));
    return html`
      <div class="progress-container">
        ${this.label || clamped !== undefined ? html`
          <div class="progress-header">
            ${this.label ? html`<span class="progress-label">${this.label}</span>` : nothing}
            <span class="progress-value">${clamped}%</span>
          </div>
        ` : nothing}
        <div class="track" role="progressbar" aria-valuenow=${clamped} aria-valuemin="0" aria-valuemax="100">
          <div class="bar bar--${this.variant}" style="width: ${clamped}%"></div>
        </div>
        ${this.caption ? html`<p class="progress-caption">${this.caption}</p>` : nothing}
      </div>
    `;
  }
}
