import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

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
 * Expected props from connector:
 * ```json
 * {
 *   "title": "Book an Appointment",
 *   "fields": [
 *     { "name": "name", "label": "Full Name", "type": "text", "placeholder": "Jane Doe" },
 *     { "name": "date", "label": "Preferred Date", "type": "date" }
 *   ],
 *   "buttonText": "Book Now"
 * }
 * ```
 *
 * On submit, calls the injected `sendEvent("form_submit", formData)`.
 * Listens for `"form_success"` event — shows appointment code view.
 */
@customElement("ai-appointment-form")
export class AIAppointmentForm extends LitElement {
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

    input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

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

    /* Success view */
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

    .appointment-code {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      margin: 0 0 12px;
      padding: 12px 16px;
      background: #f0f9ff;
      border-radius: 8px;
      color: #0369a1;
      font-family: "SF Mono", "Fira Code", monospace;
    }

    .success-hint {
      font-size: 0.8125rem;
      color: #64748b;
      margin: 0;
    }
  `;

  @property({ type: String }) title = "Book an Appointment";
  @property({ type: Array }) fields: FormField[] = [];
  @property({ type: String }) buttonText = "Book Now";
  @property({ type: String }) uniqueId = Math.random().toString(36).substring(2, 9);

  @state() private _submitDisabled = false;
  @state() private _processing = false;
  @state() private _appointmentCode = "";
  @state() private _successMessage = "";

  /** Injected by GenUIMessage — scoped to this component's chunk id. */
  sendEvent?: (type: string, payload: unknown) => void;
  listenEvent?: (type: string, cb: (payload: unknown) => void) => void;

  override connectedCallback() {
    super.connectedCallback();
    this.listenEvent?.("form_success", (payload) => {
      const p = payload as Record<string, unknown>;
      this._processing = false;
      this._submitDisabled = true;
      if (p["code"]) {
        this._appointmentCode = String(p["code"]);
        this._successMessage = (p["message"] as string | undefined) ?? "Appointment successfully booked.";
      }
    });
  }

  private _handleSubmit(e: Event) {
    e.preventDefault();
    if (this._submitDisabled || this._processing) return;

    const form = e.target as HTMLFormElement;
    const data: Record<string, string> = {};
    new FormData(form).forEach((v, k) => { data[k] = String(v); });

    this._processing = true;
    this.sendEvent?.("form_submit", data);
  }

  override render() {
    if (this._appointmentCode) {
      return html`
        <div class="success-container">
          <h3 class="success-title">✅ ${this._successMessage}</h3>
          <div class="appointment-code">${this._appointmentCode}</div>
          <p class="success-hint">Please save this code for your reference.</p>
        </div>
      `;
    }

    return html`
      <div class="form-container">
        <h3>${this.title}</h3>
        <form @submit=${this._handleSubmit}>
          ${this.fields.map((field) => html`
            <div class="field">
              <label for=${`field-${field.name}-${field.id ?? ""}-${this.uniqueId}`}>
                ${field.label}
              </label>
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
          <button
            class="submit-btn"
            type="submit"
            ?disabled=${this._submitDisabled || this._processing}
          >
            ${this._processing ? "Processing…" : this.buttonText}
          </button>
        </form>
      </div>
    `;
  }
}
