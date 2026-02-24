import { html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";

interface FormField {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  id?: string;
  value?: string;
  disabled?: boolean;
}

/**
 * `<ai-appointment-form>` — Sandbox demo GenUI component for appointment booking.
 * Register with: `GenUIRegistry.register("appointment-form", AIAppointmentForm)`
 *
 * Uses the injected `translate` / `onLangChange` API provided by GenUIMessage,
 * so this component has no direct dependency on i18next.
 */
@customElement("ai-appointment-form")
export class AIAppointmentForm extends ChativaElement {
  static override styles = css`
    :host { display: block; }

    .form-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      max-width: 400px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    h3 {
      margin: 0 0 16px;
      font-size: 1.0625rem;
      font-weight: 600;
      color: #0f172a;
    }

    .field { margin-bottom: 14px; }

    label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #475569;
      margin-bottom: 4px;
    }

    input {
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

    input:focus {
      border-color: var(--chativa-primary-color, #4f46e5);
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
    }

    input:disabled { opacity: 0.6; cursor: not-allowed; }

    .submit-btn {
      width: 100%;
      padding: 10px;
      background: var(--chativa-primary-color, #4f46e5);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 0.15s;
      margin-top: 4px;
    }

    .submit-btn:hover { opacity: 0.9; }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .success-container {
      background: #ffffff;
      border: 1px solid #a5f3fc;
      border-radius: 12px;
      padding: 24px 20px;
      max-width: 400px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
      font-family: inherit;
      text-align: center;
    }

    .success-title {
      margin: 0 0 16px;
      font-size: 1rem;
      font-weight: 600;
      color: #0f172a;
    }

    .code-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 0 0 12px;
    }

    .appointment-code {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      padding: 12px 16px;
      background: #f0f9ff;
      border-radius: 8px;
      color: #0369a1;
      font-family: "SF Mono", "Fira Code", monospace;
    }

    .copy-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      background: transparent;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .copy-btn:hover { border-color: #0369a1; color: #0369a1; background: #f0f9ff; }
    .copy-btn.copied { border-color: #16a34a; color: #16a34a; background: #f0fdf4; }

    .copy-btn svg { width: 16px; height: 16px; display: block; }

    .success-hint { font-size: 0.8125rem; color: #64748b; margin: 0; }
  `;

  @property({ type: String }) title = "";
  @property({ type: Array }) fields: FormField[] = [];
  @property({ type: String }) buttonText = "";
  @property({ type: String }) uniqueId = Math.random().toString(36).substring(2, 9);

  @state() private _submitDisabled = false;
  @state() private _processing = false;
  @state() private _appointmentCode = "";
  @state() private _successMessage = "";
  @state() private _copied = false;
  /** Cached success payload from a pre-defined stream event (arrives before submission). */
  private _pendingSuccess: Record<string, unknown> | null = null;

  /** Injected by GenUIMessage */
  sendEvent?: (type: string, payload: unknown) => void;
  listenEvent?: (type: string, cb: (payload: unknown) => void) => void;

  override connectedCallback() {
    super.connectedCallback(); // ChativaElement handles languageChanged subscription
    this.listenEvent?.("form_success", (payload) => {
      const p = payload as Record<string, unknown>;
      if (this._processing || this._submitDisabled) {
        // Server responded after user submitted — show success now
        this._processing = false;
        this._submitDisabled = true;
        this._appointmentCode = p["code"] ? String(p["code"]) : "";
        // Only store server-provided message; fallback resolved at render time
        this._successMessage = (p["message"] as string | undefined) ?? "";
      } else {
        // Success pre-defined in stream — hold until user submits
        this._pendingSuccess = p;
      }
    });
  }

  private _handleSubmit(e: Event) {
    e.preventDefault();
    if (this._submitDisabled || this._processing) return;
    const form = e.target as HTMLFormElement;
    const data: Record<string, string> = {};
    new FormData(form).forEach((v, k) => { data[k] = String(v); });

    if (this._pendingSuccess) {
      // Success payload already available — no round-trip needed
      const p = this._pendingSuccess;
      this._submitDisabled = true;
      this._appointmentCode = p["code"] ? String(p["code"]) : "";
      // Only store server-provided message; fallback resolved at render time
      this._successMessage = (p["message"] as string | undefined) ?? "";
      return;
    }

    this._processing = true;
    this.sendEvent?.("form_submit", data);
  }

  private async _copyCode() {
    try {
      await navigator.clipboard.writeText(this._appointmentCode);
      this._copied = true;
      setTimeout(() => { this._copied = false; }, 2000);
    } catch { /* clipboard unavailable */ }
  }

  override render() {
    const resolvedTitle = this.title || this.t("genui.appointment.title", { defaultValue: "Book an Appointment" });
    const resolvedButton = this.buttonText || this.t("genui.appointment.submit", { defaultValue: "Book Now" });

    if (this._appointmentCode) {
      const copyLabel = this._copied
        ? this.t("genui.appointment.copied", { defaultValue: "Copied!" })
        : this.t("genui.appointment.copy", { defaultValue: "Copy" });
      const successMsg = this._successMessage
        || this.t("genui.appointment.successDefault", { defaultValue: "Appointment successfully booked." });

      return html`
        <div class="success-container">
          <h3 class="success-title">✅ ${successMsg}</h3>
          <div class="code-row">
            <span class="appointment-code">${this._appointmentCode}</span>
            <button class="copy-btn ${this._copied ? "copied" : ""}" @click=${this._copyCode} title=${copyLabel} aria-label=${copyLabel}>
              ${this._copied
                ? html`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,8 6,12 14,4"/></svg>`
                : html`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>`}
            </button>
          </div>
          <p class="success-hint">${this.t("genui.appointment.codeHint", { defaultValue: "Please save this code for your reference." })}</p>
        </div>
      `;
    }

    return html`
      <div class="form-container">
        <h3>${resolvedTitle}</h3>
        <form @submit=${this._handleSubmit}>
          ${this.fields.map((field) => html`
            <div class="field">
              <label for=${`field-${field.name}-${field.id ?? ""}-${this.uniqueId}`}>${field.label}</label>
              <input
                id=${`field-${field.name}-${field.id ?? ""}-${this.uniqueId}`}
                type=${field.type}
                name=${field.name}
                .value=${field.value ?? ""}
                ?disabled=${field.disabled === true || this._processing}
                placeholder=${field.placeholder ?? ""}
                required
              />
            </div>
          `)}
          <button class="submit-btn" type="submit" ?disabled=${this._submitDisabled || this._processing}>
            ${this._processing
              ? this.t("genui.form.processing", { defaultValue: "Processing…" })
              : resolvedButton}
          </button>
        </form>
      </div>
    `;
  }
}
