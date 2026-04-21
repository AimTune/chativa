import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "i18next";
import "../i18n/i18n";
import { chatStore, type EndOfConversationSurveyConfig } from "@chativa/core";
import { ChatbotMixin } from "../mixins/ChatbotMixin";

/**
 * End-of-conversation survey — star rating + optional comment.
 *
 * Rendered two ways:
 *  - `inline` (default): via `MessageTypeRegistry` as a bot-authored card inside
 *    the message list. `.messageData` / `.messageId` are set by `ChatMessageList`.
 *  - `screen`: as a full-height overlay inside `ChatWidget`. Set `overlay=true`.
 *
 * On submit, dispatches `survey-submitted` (bubbles, composed) with
 * `{ rating, comment, kind, messageId? }`. `ChatWidget` calls
 * `ChatEngine.sendSurvey(...)`, marks the message as `submitted: true`, and
 * the card re-renders in its thank-you state.
 */
@customElement("end-of-conversation-survey")
export class EndOfConversationSurvey extends ChatbotMixin(LitElement) {
  static override styles = css`
    :host {
      display: block;
      --ring: rgba(79, 70, 229, 0.35);
    }

    :host([overlay]) {
      flex: 1;
      min-height: 0;
      display: block;
    }

    .card {
      background: #ffffff;
      border: 1px solid var(--chativa-border, #e2e8f0);
      border-radius: 14px;
      padding: 18px 20px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
      max-width: 340px;
      margin: 8px 0;
      font-family: inherit;
      color: var(--chativa-text, #0f172a);
    }

    :host([overlay]) .card {
      max-width: none;
      margin: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      border: none;
      border-radius: 0;
      box-shadow: none;
      padding: 24px 20px;
      box-sizing: border-box;
    }

    :host([overlay]) .title {
      margin-top: 8px;
    }

    :host([overlay]) textarea {
      flex: 1;
      min-height: 96px;
    }

    :host([overlay]) .actions {
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid var(--chativa-border, #e2e8f0);
      gap: 10px;
    }

    :host([overlay]) .actions button {
      flex: 1;
      padding: 12px 16px;
      font-size: 0.875rem;
      font-weight: 600;
      min-height: 44px;
    }

    .title {
      margin: 0 0 14px;
      font-size: 0.9375rem;
      font-weight: 600;
      text-align: center;
    }

    .stars {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-bottom: 14px;
    }

    .star {
      font-size: 2rem;
      line-height: 1;
      background: none;
      border: none;
      padding: 2px;
      cursor: pointer;
      opacity: 0.3;
      transition: transform 0.1s ease, opacity 0.1s ease;
      user-select: none;
    }

    .star:focus-visible {
      outline: 2px solid var(--ring);
      border-radius: 4px;
    }

    .star--active { opacity: 1; }
    .star--hovered { transform: scale(1.2); opacity: 1; }
    .star[disabled] { cursor: default; }

    textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 72px;
      padding: 8px 10px;
      font-family: inherit;
      font-size: 0.875rem;
      border: 1px solid var(--chativa-border, #cbd5e1);
      border-radius: 8px;
      resize: vertical;
      margin-bottom: 10px;
      color: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    textarea:focus {
      outline: none;
      border-color: var(--chativa-primary-color, #4f46e5);
      box-shadow: 0 0 0 3px var(--ring);
    }

    textarea.invalid {
      border-color: #ef4444;
    }

    textarea.invalid:focus {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25);
    }

    .required-note {
      margin: -6px 0 8px;
      font-size: 0.75rem;
      color: #ef4444;
      text-align: left;
    }

    /* ── Thank-you state ──────────────────────────────────────── */

    .thanks {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 14px;
      padding: 24px 4px 8px;
    }

    :host([overlay]) .thanks {
      flex: 1;
      padding: 0;
      gap: 0;
    }

    .thanks-main {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }

    :host([overlay]) .thanks-main {
      flex: 1;
      justify-content: center;
    }

    .thanks-icon {
      width: 96px;
      height: 96px;
      flex-shrink: 0;
    }

    .thanks-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--chativa-primary-color, #4f46e5);
    }

    .thanks-body {
      margin: 0;
      font-size: 0.875rem;
      color: var(--chativa-secondary-color, #475569);
      max-width: 28ch;
      line-height: 1.4;
    }

    .thanks-footer {
      margin-top: 4px;
      width: 100%;
      display: flex;
      justify-content: center;
    }

    :host([overlay]) .thanks-footer {
      margin-top: 0;
      padding-top: 16px;
      border-top: 1px solid var(--chativa-border, #e2e8f0);
    }

    .close-btn {
      width: 100%;
      max-width: 320px;
      background: var(--chativa-primary-color, #4f46e5);
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 12px 22px;
      font-size: 0.875rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      cursor: pointer;
      transition: opacity 0.15s;
      font-family: inherit;
    }

    .close-btn:hover { opacity: 0.9; }

    .actions {
      display: flex;
      justify-content: center;
      gap: 8px;
    }

    button.primary {
      background: var(--chativa-primary-color, #4f46e5);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 8px 22px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    button.primary:hover { opacity: 0.88; }
    button.primary:disabled {
      background: #cbd5e1;
      cursor: not-allowed;
    }

    button.secondary {
      background: transparent;
      color: var(--chativa-secondary-color, #475569);
      border: 1px solid var(--chativa-border, #cbd5e1);
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 0.875rem;
      cursor: pointer;
    }

  `;

  /** Populated automatically when rendered via ChatMessageList. */
  @property({ type: Object }) messageData: Record<string, unknown> = {};
  @property({ type: String }) messageId = "";

  /** Set to true when rendered as a fullscreen overlay (screen mode). */
  @property({ type: Boolean, reflect: true }) overlay = false;

  @state() private _rating = 0;
  @state() private _hovered = 0;
  @state() private _comment = "";
  @state() private _submitted = false;

  private get _config(): EndOfConversationSurveyConfig {
    return chatStore.getState().theme.endOfConversationSurvey ?? {};
  }

  private get _maxRating(): number {
    const n = this._config.maxRating;
    return typeof n === "number" && n > 0 ? n : 5;
  }

  private get _requireCommentBelow(): number {
    const n = this._config.requireCommentBelow;
    return typeof n === "number" ? n : 3;
  }

  private _onStar(n: number) {
    this._rating = n;
  }

  private _onComment(e: Event) {
    this._comment = (e.target as HTMLTextAreaElement).value;
  }

  private get _commentRequired(): boolean {
    const threshold = this._requireCommentBelow;
    return (
      threshold > 0 &&
      this._rating > 0 &&
      this._rating <= threshold &&
      this._comment.trim() === ""
    );
  }

  private get _submitDisabled(): boolean {
    return this._rating === 0 || this._commentRequired;
  }

  private _submit() {
    if (this._rating === 0 || this._commentRequired) return;
    this._submitted = true;
    this.dispatchEvent(
      new CustomEvent("survey-submitted", {
        bubbles: true,
        composed: true,
        detail: {
          rating: this._rating,
          comment: this._comment.trim(),
          kind: this._config.kind ?? 1,
          messageId: this.messageId,
        },
      }),
    );
  }

  private _skip() {
    this.dispatchEvent(
      new CustomEvent("survey-skipped", {
        bubbles: true,
        composed: true,
        detail: { messageId: this.messageId },
      }),
    );
  }

  private _close() {
    this.dispatchEvent(
      new CustomEvent("survey-close", {
        bubbles: true,
        composed: true,
        detail: { messageId: this.messageId },
      }),
    );
  }

  private _renderStars() {
    const stars = Array.from({ length: this._maxRating }, (_, i) => i + 1);
    const active = this._hovered || this._rating;
    return html`
      <div
        class="stars"
        role="group"
        aria-label=${t("survey.ratingLabel")}
      >
        ${stars.map(
          (n) => html`
            <button
              class="star ${n <= active ? "star--active" : ""} ${n ===
              this._hovered
                ? "star--hovered"
                : ""}"
              type="button"
              aria-label=${t("survey.starLabel", { count: n })}
              aria-pressed=${n === this._rating}
              @click=${() => this._onStar(n)}
              @mouseenter=${() => {
                this._hovered = n;
              }}
              @mouseleave=${() => {
                this._hovered = 0;
              }}
            >
              ⭐
            </button>
          `,
        )}
      </div>
    `;
  }

  private _renderThanks() {
    return html`
      <div class="thanks">
        <div class="thanks-main">
          <svg class="thanks-icon" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="60" cy="60" r="44" fill="#dcfce7" />
            <circle cx="60" cy="60" r="30" fill="#16a34a" />
            <path d="M46 60 l10 10 l18 -20" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            ${[
              [18, 30],
              [100, 32],
              [22, 92],
              [98, 88],
              [58, 14],
              [60, 108],
            ].map(
              ([cx, cy]) => html`<g transform="translate(${cx} ${cy})">
                <path d="M0 -4 L1.2 -1.2 L4 0 L1.2 1.2 L0 4 L-1.2 1.2 L-4 0 L-1.2 -1.2 Z" fill="#86efac" opacity="0.75" />
              </g>`,
            )}
          </svg>
          <h3 class="thanks-title">${t("survey.thankYouTitle")}</h3>
          <p class="thanks-body">${t("survey.thankYouBody")}</p>
        </div>
        <div class="thanks-footer">
          <button class="close-btn" type="button" @click=${this._close}>
            ${t("survey.close")}
          </button>
        </div>
      </div>
    `;
  }

  override render() {
    if (this._submitted) {
      return html`<div class="card">${this._renderThanks()}</div>`;
    }
    const needsComment = this._commentRequired;
    return html`
      <div class="card">
        <h3 class="title">${t("survey.title")}</h3>
        ${this._renderStars()}
        <textarea
          class=${needsComment ? "invalid" : ""}
          placeholder=${t("survey.commentPlaceholder")}
          aria-invalid=${needsComment}
          .value=${this._comment}
          @input=${this._onComment}
        ></textarea>
        ${needsComment
          ? html`<div class="required-note">${t("survey.commentRequired")}</div>`
          : nothing}
        <div class="actions">
          <button
            class="primary"
            type="button"
            ?disabled=${this._submitDisabled}
            @click=${this._submit}
          >
            ${t("survey.submit")}
          </button>
          <button class="secondary" type="button" @click=${this._skip}>
            ${t("survey.skip")}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "end-of-conversation-survey": EndOfConversationSurvey;
  }
}
