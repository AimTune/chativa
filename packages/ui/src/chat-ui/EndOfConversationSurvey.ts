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
      justify-content: center;
      border: none;
      border-radius: 0;
      box-shadow: none;
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

  override render() {
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
