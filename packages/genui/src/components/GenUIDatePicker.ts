import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";
import type { GenUIComponentAPI } from "../types";

/**
 * GenUIDatePicker — native date input styled to match the GenUI form palette.
 *
 * Registered as "genui-date-picker" in GenUIRegistry.
 *
 * @fires sendEvent("date_select", { date: string }) — when the user selects a date
 *
 * @example (AIChunk)
 * ```json
 * { "type": "ui", "component": "genui-date-picker", "props": { "label": "Appointment date", "min": "2025-01-01" } }
 * ```
 */
@customElement("genui-date-picker")
export class GenUIDatePicker extends ChativaElement {
  static override styles = css`
    :host {
      display: block;
    }

    .date-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      max-width: 320px;
      background: #ffffff;
      font-family: inherit;
    }

    label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #475569;
      margin-bottom: 6px;
    }

    input[type="date"] {
      width: 100%;
      padding: 8px 12px;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.875rem;
      box-sizing: border-box;
      background: #f8fafc;
      color: #0f172a;
      font-family: inherit;
      transition: border-color 0.15s;
      outline: none;
    }

    input[type="date"]:focus {
      border-color: var(--chativa-primary-color, #4f46e5);
      background: #ffffff;
    }

    input[type="date"]:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;

  /** Label shown above the input. Falls back to i18n key. */
  @property({ type: String }) label?: string;
  /** Minimum selectable date (ISO 8601, e.g. "2025-01-01"). */
  @property({ type: String }) min?: string;
  /** Maximum selectable date. */
  @property({ type: String }) max?: string;
  /** Current value (ISO 8601 date string). */
  @property({ type: String }) value?: string;
  /** Whether the input is disabled. */
  @property({ type: Boolean }) disabled = false;

  /** Injected by GenUIMessage at render time. */
  sendEvent?: GenUIComponentAPI["sendEvent"];

  private _onChange(e: Event) {
    const date = (e.target as HTMLInputElement).value;
    this.value = date;
    this.sendEvent?.("date_select", { date });
  }

  override render() {
    const labelText = this.label ?? this.t("genui.datePicker.label");

    return html`
      <div class="date-card">
        <label for="genui-date-input">${labelText}</label>
        <input
          id="genui-date-input"
          type="date"
          .value=${this.value ?? ""}
          ?disabled=${this.disabled}
          min=${this.min ?? nothing}
          max=${this.max ?? nothing}
          @change=${this._onChange}
        />
      </div>
    `;
  }
}
