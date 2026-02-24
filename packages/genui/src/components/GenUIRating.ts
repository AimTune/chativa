import { html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";

/**
 * `<genui-rating>` — built-in star-rating component for Generative UI streams.
 *
 * Expected props from connector:
 * ```json
 * {
 *   "title": "How satisfied are you?",
 *   "maxStars": 5,
 *   "readonly": false
 * }
 * ```
 *
 * On submit, calls the injected `sendEvent("rating_submit", { rating: number })`.
 */
@customElement("genui-rating")
export class GenUIRating extends ChativaElement {
  static override styles = css`
    :host { display: block; }

    .rating-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 20px;
      max-width: 320px;
      text-align: center;
      font-family: inherit;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .rating-title {
      margin: 0 0 14px;
      font-size: 0.9375rem;
      font-weight: 600;
      color: #0f172a;
    }

    .stars {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-bottom: 14px;
    }

    .star {
      font-size: 2rem;
      cursor: pointer;
      transition: transform 0.1s ease, opacity 0.1s;
      line-height: 1;
      border: none;
      background: none;
      padding: 0;
      opacity: 0.3;
      user-select: none;
    }

    .star:focus-visible {
      outline: 2px solid var(--chativa-primary-color, #4f46e5);
      border-radius: 4px;
    }

    .star--active { opacity: 1; }
    .star--hovered { transform: scale(1.2); opacity: 1; }

    .star[disabled] { cursor: default; }

    .submit-btn {
      padding: 8px 24px;
      background: var(--chativa-primary-color, #4f46e5);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 0.15s;
    }

    .submit-btn:hover { opacity: 0.88; }
    .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .thank-you {
      font-size: 0.875rem;
      color: #16a34a;
      font-weight: 500;
    }
  `;

  @property({ type: String }) title = "";
  @property({ type: Number }) maxStars = 5;
  @property({ type: Boolean }) readonly = false;
  @property({ type: Number }) value = 0;

  @state() private _selected = 0;
  @state() private _hovered = 0;
  @state() private _submitted = false;

  /** Injected by GenUIMessage */
  sendEvent?: (type: string, payload: unknown) => void;

  override connectedCallback() {
    super.connectedCallback(); // I18nMixin handles languageChanged
    if (this.value) this._selected = this.value;
  }

  private _onStarClick(n: number) {
    if (this.readonly || this._submitted) return;
    this._selected = n;
  }

  private _onSubmit() {
    if (!this._selected || this._submitted) return;
    this._submitted = true;
    this.sendEvent?.("rating_submit", { rating: this._selected });
  }

  override render() {
    const stars = Array.from({ length: this.maxStars }, (_, i) => i + 1);
    const active = this._hovered || this._selected;
    const isReadonly = this.readonly || this._submitted;

    return html`
      <div class="rating-card">
        ${this.title ? html`<h3 class="rating-title">${this.title}</h3>` : nothing}
        <div class="stars" role="group" aria-label=${this.t("genui.rating.ariaLabel", { defaultValue: "Star rating" })}>
          ${stars.map((n) => html`
            <button
              class="star ${n <= active ? "star--active" : ""} ${n === this._hovered && !isReadonly ? "star--hovered" : ""}"
              type="button"
              aria-label=${this.t("genui.rating.starLabel", { count: n, defaultValue: "{{count}} star" })}
              ?disabled=${isReadonly}
              @click=${() => this._onStarClick(n)}
              @mouseenter=${() => { if (!isReadonly) this._hovered = n; }}
              @mouseleave=${() => { this._hovered = 0; }}
            >⭐</button>
          `)}
        </div>
        ${this._submitted
          ? html`<p class="thank-you">${this.t("genui.rating.thankYou", { defaultValue: "Thank you for your feedback!" })}</p>`
          : !isReadonly
            ? html`
                <button
                  class="submit-btn"
                  type="button"
                  ?disabled=${!this._selected}
                  @click=${this._onSubmit}
                >${this.t("genui.rating.submit", { defaultValue: "Submit" })}</button>
              `
            : nothing}
      </div>
    `;
  }
}
