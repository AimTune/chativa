import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

/**
 * `<approval-form>` — Sandbox Generative UI component for mekik's human-in-the-loop
 * pause. Register with: `GenUIRegistry.register("approval-form", ApprovalForm)`
 *
 * Mounted by an *interrupt* frame rather than a plain GenUI chunk:
 * `mekik.approve(ctx, payload, { ui: { component: "approval-form", props: { … } } })`
 *
 * ```json
 * { "orderId": "ORD-42", "amount": 249.9, "tool": "refund_payment" }
 * ```
 *
 * Clicking a button dispatches `chat-action` with a plain string, which the host
 * sends as the resume answer. mekik's `isApproved` accepts yes-ish strings
 * ("approve", "yes", "onay", …), so "approve" / "reject" resolve the pause
 * without the component needing to know the interrupt id.
 *
 * The graph is parked until this is answered, so the buttons disable themselves
 * on click: a second answer has nothing left to resolve, and a double-click
 * should not look like it did something.
 */
@customElement("approval-form")
export class ApprovalForm extends LitElement {
  static override styles = css`
    :host { display: block; }

    .card {
      border-radius: 16px;
      max-width: 340px;
      padding: 18px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #fffbeb;
      border: 1px solid #fcd34d;
      box-shadow: 0 6px 20px rgba(180, 83, 9, 0.15);
      color: #78350f;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #b45309;
      margin-bottom: 10px;
    }

    .title { font-size: 1rem; font-weight: 600; line-height: 1.4; margin-bottom: 12px; }

    dl {
      margin: 0 0 16px;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 14px;
      font-size: 0.85rem;
    }
    dt { color: #92400e; opacity: 0.85; }
    dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }

    .actions { display: flex; gap: 10px; }

    button {
      flex: 1;
      padding: 10px 14px;
      border-radius: 10px;
      border: none;
      font: inherit;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      transition: transform 0.06s ease, opacity 0.15s ease;
    }
    button:active { transform: translateY(1px); }
    button:disabled { cursor: default; opacity: 0.45; }

    .approve { background: #059669; color: white; }
    .reject { background: white; color: #b91c1c; border: 1px solid #fca5a5; }

    .answered {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .answered.yes { color: #047857; }
    .answered.no { color: #b91c1c; }
  `;

  @property({ type: String }) title = "";
  @property({ type: String }) orderId = "";
  @property({ type: Number }) amount = 0;
  @property({ type: String }) tool = "";

  @state() private _answer: "approve" | "reject" | null = null;

  private _send(answer: "approve" | "reject") {
    if (this._answer) return; // the pause is already resolved
    this._answer = answer;
    this.dispatchEvent(
      new CustomEvent<string>("chat-action", {
        detail: answer,
        bubbles: true,
        composed: true,
      })
    );
  }

  override render() {
    return html`
      <div class="card">
        <div class="badge">⏸ awaiting your approval</div>
        <div class="title">
          ${this.title || (this.orderId ? `Refund ${this.orderId}?` : "Approve this action?")}
        </div>

        ${this.orderId || this.amount || this.tool
          ? html`
              <dl>
                ${this.orderId ? html`<dt>Order</dt><dd>${this.orderId}</dd>` : nothing}
                ${this.amount ? html`<dt>Amount</dt><dd>$${this.amount}</dd>` : nothing}
                ${this.tool ? html`<dt>Action</dt><dd>${this.tool}</dd>` : nothing}
              </dl>
            `
          : nothing}

        ${this._answer === null
          ? html`
              <div class="actions">
                <button class="approve" @click=${() => this._send("approve")}>Approve</button>
                <button class="reject" @click=${() => this._send("reject")}>Reject</button>
              </div>
            `
          : html`
              <p class="answered ${this._answer === "approve" ? "yes" : "no"}">
                ${this._answer === "approve" ? "✓ Approved" : "✕ Rejected"}
              </p>
            `}
      </div>
    `;
  }
}
