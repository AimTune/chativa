import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";

export interface GenUIStep {
  label: string;
  description?: string;
  status: "done" | "active" | "pending";
}

/**
 * GenUISteps — vertical step tracker.
 *
 * Registered as "genui-steps" in GenUIRegistry.
 *
 * @example (AIChunk)
 * ```json
 * { "type": "ui", "component": "genui-steps", "props": {
 *   "steps": [
 *     { "label": "Order placed", "status": "done" },
 *     { "label": "Preparing", "status": "active", "description": "Your order is being prepared." },
 *     { "label": "Delivery", "status": "pending" }
 *   ]
 * }}
 * ```
 */
@customElement("genui-steps")
export class GenUISteps extends ChativaElement {
  static override styles = css`
    :host {
      display: block;
    }

    .steps-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      max-width: 380px;
      font-family: inherit;
    }

    .step {
      display: flex;
      gap: 12px;
      position: relative;
    }

    /* Vertical connector line between steps */
    .step:not(:last-child) .step-left::after {
      content: "";
      position: absolute;
      left: 11px;
      top: 28px;
      bottom: -6px;
      width: 2px;
      background: #e2e8f0;
    }

    .step:not(:last-child) .step-left.done::after {
      background: var(--chativa-primary-color, #4f46e5);
    }

    .step-left {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      flex-shrink: 0;
    }

    .step-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      z-index: 1;
    }

    .step-icon--done {
      background: var(--chativa-primary-color, #4f46e5);
      color: #ffffff;
    }

    .step-icon--active {
      background: var(--chativa-primary-color, #4f46e5);
      animation: step-pulse 1.4s ease-in-out infinite;
    }

    .step-icon--pending {
      background: #ffffff;
      border: 2px solid #e2e8f0;
    }

    @keyframes step-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
      50%       { box-shadow: 0 0 0 6px rgba(79, 70, 229, 0); }
    }

    .step-content {
      padding-bottom: 16px;
      flex: 1;
      min-width: 0;
    }

    .step:last-child .step-content {
      padding-bottom: 0;
    }

    .step-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.5;
    }

    .step-label--pending {
      color: #94a3b8;
      font-weight: 400;
    }

    .step-description {
      font-size: 0.8125rem;
      color: #64748b;
      margin-top: 2px;
      line-height: 1.4;
    }
  `;

  @property({ type: Array }) steps?: GenUIStep[];

  private _renderIcon(status: GenUIStep["status"]) {
    if (status === "done") {
      return html`
        <div class="step-icon step-icon--done">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      `;
    }
    if (status === "active") {
      return html`
        <div class="step-icon step-icon--active">
          <div style="width:8px;height:8px;background:white;border-radius:50%;"></div>
        </div>
      `;
    }
    return html`<div class="step-icon step-icon--pending"></div>`;
  }

  override render() {
    const steps = this.steps ?? [];
    if (steps.length === 0) return nothing;

    return html`
      <div class="steps-container">
        ${steps.map((step) => html`
          <div class="step">
            <div class="step-left ${step.status}">
              ${this._renderIcon(step.status)}
            </div>
            <div class="step-content">
              <div class="step-label ${step.status === "pending" ? "step-label--pending" : ""}">
                ${step.label}
              </div>
              ${step.description
                ? html`<div class="step-description">${step.description}</div>`
                : nothing}
            </div>
          </div>
        `)}
      </div>
    `;
  }
}
