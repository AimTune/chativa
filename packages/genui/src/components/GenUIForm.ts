import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import i18next, { t } from "i18next";

export interface GenUIFormField {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * `<genui-form>` — built-in dynamic form component for Generative UI streams.
 *
 * Expected props from connector:
 * ```json
 * {
 *   "title": "Subscribe",
 *   "fields": [
 *     { "name": "email", "label": "Email", "type": "email", "placeholder": "you@example.com" }
 *   ],
 *   "buttonText": "Submit"
 * }
 * ```
 *
 * On submit, calls the injected `sendEvent("form_submit", formData)`.
 * Listens for `"form_success"` event to enter success state.
 * Listens for `"form_error"` event to show error message.
 */
@customElement("genui-form")
export class GenUIForm extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .form-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      max-width: 360px;
      background: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      font-family: inherit;
    }

    .form-title {
      margin: 0 0 16px;
      font-size: 1rem;
      font-weight: 600;
      color: #0f172a;
    }

    .field {
      margin-bottom: 14px;
    }

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

    /* Success state */
    .success-card {
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 20px;
      max-width: 360px;
      background: #f0fdf4;
      text-align: center;
      font-family: inherit;
    }

    .success-icon {
      font-size: 2rem;
      margin-bottom: 8px;
    }

    .success-title {
      margin: 0 0 6px;
      font-size: 1rem;
      font-weight: 600;
      color: #15803d;
    }

    .success-message {
      font-size: 0.8125rem;
      color: #166534;
    }

    .error-msg {
      margin-top: 10px;
      padding: 8px 12px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      font-size: 0.8125rem;
      color: #dc2626;
    }
  `;

  @property({ type: String }) title = "";
  @property({ type: Array }) fields: GenUIFormField[] = [];
  @property({ type: String }) buttonText = "";

  @state() private _submitted = false;
  @state() private _processing = false;
  @state() private _successMessage = "";
  @state() private _errorMessage = "";

  /** Injected by GenUIMessage — scoped to this component's chunk id. */
  sendEvent?: (type: string, payload: unknown) => void;
  listenEvent?: (type: string, cb: (payload: unknown) => void) => void;

  private _onLangChange = () => { this.requestUpdate(); };

  override connectedCallback() {
    super.connectedCallback();
    i18next.on("languageChanged", this._onLangChange);
    this.listenEvent?.("form_success", (payload) => {
      this._processing = false;
      this._submitted = true;
      const p = payload as Record<string, unknown>;
      this._successMessage = (p["message"] as string | undefined)
        ?? t("genui.form.successDefault", { defaultValue: "Done!" });
    });
    this.listenEvent?.("form_error", (payload) => {
      this._processing = false;
      const p = payload as Record<string, unknown>;
      this._errorMessage = (p["message"] as string | undefined)
        ?? t("genui.form.errorDefault", { defaultValue: "Something went wrong." });
    });
  }

  override disconnectedCallback() {
    i18next.off("languageChanged", this._onLangChange);
    super.disconnectedCallback();
  }

  private _onSubmit(e: Event) {
    e.preventDefault();
    if (this._processing || this._submitted) return;

    const form = e.target as HTMLFormElement;
    const data: Record<string, string> = {};
    new FormData(form).forEach((v, k) => { data[k] = String(v); });

    this._processing = true;
    this._errorMessage = "";
    this.sendEvent?.("form_submit", data);
  }

  override render() {
    const submitLabel = this.buttonText || t("genui.form.submit", { defaultValue: "Submit" });

    if (this._submitted) {
      return html`
        <div class="success-card">
          <div class="success-icon">✅</div>
          <h3 class="success-title">${t("genui.form.successTitle", { defaultValue: "Success" })}</h3>
          <p class="success-message">${this._successMessage}</p>
        </div>
      `;
    }

    return html`
      <div class="form-card">
        ${this.title ? html`<h3 class="form-title">${this.title}</h3>` : nothing}
        <form @submit=${this._onSubmit}>
          ${this.fields.map((f) => html`
            <div class="field">
              <label for="genui-field-${f.name}">${f.label}</label>
              <input
                id="genui-field-${f.name}"
                name=${f.name}
                type=${f.type}
                placeholder=${f.placeholder ?? ""}
                .value=${f.value ?? ""}
                ?required=${f.required !== false}
                ?disabled=${f.disabled === true || this._processing}
              />
            </div>
          `)}
          <button
            class="submit-btn"
            type="submit"
            ?disabled=${this._processing}
          >
            ${this._processing
              ? t("genui.form.processing", { defaultValue: "Processing…" })
              : submitLabel}
          </button>
          ${this._errorMessage
            ? html`<div class="error-msg">${this._errorMessage}</div>`
            : nothing}
        </form>
      </div>
    `;
  }
}
