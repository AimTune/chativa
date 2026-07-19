import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * `<order-card>` — Sandbox Generative UI component for the botiva refund demo.
 * Register with: `GenUIRegistry.register("order-card", OrderCard)`
 *
 * Props emitted by the graph's `botiva.ui("order-card", { … })`:
 * ```json
 * { "id": "ORD-42", "total": 249.9, "items": ["Kettle", "Mug"] }
 * ```
 */
@customElement("order-card")
export class OrderCard extends LitElement {
  static override styles = css`
    :host { display: block; }

    .card {
      border-radius: 16px;
      overflow: hidden;
      max-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
    }

    .card-main { padding: 18px 20px 14px; }

    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .order-id {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.85;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .total {
      font-size: 2rem;
      font-weight: 700;
      line-height: 1;
    }

    .total .unit { font-size: 1.1rem; font-weight: 400; opacity: 0.8; }

    .items {
      list-style: none;
      margin: 0;
      padding: 12px 20px 16px;
      background: rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .item::before { content: "•"; opacity: 0.7; }
  `;

  @property({ type: String }) id = "";
  @property({ type: Number }) total = 0;
  @property({ type: Array }) items: string[] = [];

  override render() {
    return html`
      <div class="card">
        <div class="card-main">
          <div class="head">
            <span class="order-id">🧾 ${this.id}</span>
          </div>
          <div class="total">${this.total}<span class="unit"> ₺</span></div>
        </div>
        ${this.items.length > 0
          ? html`<ul class="items">
              ${this.items.map((it) => html`<li class="item">${it}</li>`)}
            </ul>`
          : nothing}
      </div>
    `;
  }
}
