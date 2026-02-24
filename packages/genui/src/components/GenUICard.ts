import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";

export interface GenUICardAction {
  label: string;
  value: string;
}

/**
 * `<genui-card>` — built-in card component for Generative UI streams.
 *
 * Expected props from connector:
 * ```json
 * {
 *   "title": "Pro Plan",
 *   "description": "All features included",
 *   "image": "https://...",          // optional
 *   "actions": [{ "label": "Select", "value": "select_pro" }]  // optional
 * }
 * ```
 * Action clicks dispatch a `chat-action` CustomEvent (bubbles + composed)
 * compatible with the existing Chativa action pipeline.
 */
@customElement("genui-card")
export class GenUICard extends ChativaElement {
  static override styles = css`
    :host {
      display: block;
    }

    .card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      transition: box-shadow 0.2s ease;
      max-width: 320px;
      font-family: inherit;
    }

    .card:hover {
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
    }

    .card-image {
      width: 100%;
      height: 160px;
      object-fit: cover;
      display: block;
    }

    .card-body {
      padding: 14px 16px;
    }

    .card-title {
      margin: 0 0 6px;
      font-size: 1rem;
      font-weight: 600;
      color: #0f172a;
    }

    .card-description {
      margin: 0 0 12px;
      font-size: 0.8125rem;
      color: #64748b;
      line-height: 1.5;
    }

    .card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .action-btn {
      padding: 7px 14px;
      border: 1.5px solid var(--chativa-primary-color, #4f46e5);
      border-radius: 999px;
      background: transparent;
      color: var(--chativa-primary-color, #4f46e5);
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, color 0.15s;
    }

    .action-btn:hover {
      background: var(--chativa-primary-color, #4f46e5);
      color: #ffffff;
    }
  `;

  @property({ type: String }) title = "";
  @property({ type: String }) description = "";
  @property({ type: String }) image = "";
  @property({ type: Array }) actions: GenUICardAction[] = [];

  private _onAction(value: string) {
    this.dispatchEvent(
      new CustomEvent<string>("chat-action", {
        detail: value,
        bubbles: true,
        composed: true,
      })
    );
  }

  override render() {
    return html`
      <div class="card">
        ${this.image
          ? html`<img class="card-image" src=${this.image} alt=${this.title} />`
          : nothing}
        <div class="card-body">
          ${this.title
            ? html`<h3 class="card-title">${this.title}</h3>`
            : nothing}
          ${this.description
            ? html`<p class="card-description">${this.description}</p>`
            : nothing}
          ${this.actions.length > 0
            ? html`
                <div class="card-actions">
                  ${this.actions.map(
                    (a) => html`
                      <button
                        class="action-btn"
                        type="button"
                        @click=${() => this._onAction(a.value)}
                      >${a.label}</button>
                    `
                  )}
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}
