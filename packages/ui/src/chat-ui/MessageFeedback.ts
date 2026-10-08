import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "@chativa/core";
import i18next from "../i18n/i18n";

type FeedbackValue = "like" | "dislike";

/**
 * Local (not yet server-confirmed) selections, keyed by message id. Kept at
 * module level so a selection survives the list re-using elements by
 * position (e.g. when history is prepended above).
 */
const localFeedback = new Map<string, FeedbackValue>();

/**
 * Like / dislike buttons for a bot message.
 *
 * Rendered by `chat-message-list` under every bot message regardless of its
 * type (text, buttons, card, carousel, custom, GenUI …), so message-type
 * components don't have to implement feedback themselves.
 *
 * Dispatches `chativa-feedback` ({ messageId, feedback }) — handled by
 * ChatWidget / AgentPanel, which forward it to `IConnector.sendFeedback`.
 */
@customElement("message-feedback")
export class MessageFeedback extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .feedback {
      display: flex;
      gap: 2px;
      padding: 0 2px;
    }

    .feedback-btn {
      background: none;
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 2px 5px;
      cursor: pointer;
      font-size: 0.75rem;
      line-height: 1;
      color: #94a3b8;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }

    .feedback-btn:hover {
      border-color: #e2e8f0;
      background: #f8fafc;
      color: #64748b;
    }

    .feedback-btn.selected-like {
      border-color: #bbf7d0;
      background: #f0fdf4;
      color: #16a34a;
    }

    .feedback-btn.selected-dislike {
      border-color: #fecaca;
      background: #fef2f2;
      color: #dc2626;
    }

    .feedback-btn:disabled {
      cursor: default;
      opacity: 0.7;
    }
  `;

  @property({ type: String }) messageId = "";
  @property({ type: Object }) messageData: Record<string, unknown> = {};
  /** Reflected while a value is selected so the host can keep it visible. */
  @property({ type: Boolean, reflect: true }) active = false;

  @state() private _feedback: FeedbackValue | null = null;

  private _onLangChange = () => { this.requestUpdate(); };

  /** Whether feedback is locked by the bot (DisableFeedbackButton event). */
  private get _feedbackDisabled(): boolean {
    return !!this.messageData?.feedbackDisabled;
  }

  /** Effective feedback state: server-confirmed value takes priority over local. */
  private get _effectiveFeedback(): FeedbackValue | null {
    if (this._feedbackDisabled) {
      const ft = this.messageData?.feedbackType;
      if (ft === 0) return "like";
      if (ft === 1) return "dislike";
    }
    return this._feedback;
  }

  override connectedCallback() {
    super.connectedCallback();
    i18next.on("languageChanged", this._onLangChange);
  }

  override disconnectedCallback() {
    i18next.off("languageChanged", this._onLangChange);
    super.disconnectedCallback();
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has("messageId")) {
      this._feedback = localFeedback.get(this.messageId) ?? null;
    }
    this.active = this._effectiveFeedback !== null;
  }

  private _onFeedback(type: FeedbackValue) {
    if (this._feedbackDisabled) return;
    if (this._feedback === type) {
      this._feedback = null;
      localFeedback.delete(this.messageId);
      return;
    }
    this._feedback = type;
    localFeedback.set(this.messageId, type);
    this.dispatchEvent(
      new CustomEvent("chativa-feedback", {
        bubbles: true,
        composed: true,
        detail: { messageId: this.messageId, feedback: type },
      })
    );
  }

  render() {
    const value = this._effectiveFeedback;
    return html`
      <div class="feedback">
        <button
          type="button"
          class="feedback-btn ${value === "like" ? "selected-like" : ""}"
          aria-label="${t("message.likeButton")}"
          aria-pressed="${value === "like"}"
          ?disabled=${this._feedbackDisabled}
          @click=${() => this._onFeedback("like")}
        >👍</button>
        <button
          type="button"
          class="feedback-btn ${value === "dislike" ? "selected-dislike" : ""}"
          aria-label="${t("message.dislikeButton")}"
          aria-pressed="${value === "dislike"}"
          ?disabled=${this._feedbackDisabled}
          @click=${() => this._onFeedback("dislike")}
        >👎</button>
      </div>
    `;
  }
}

export default MessageFeedback;
