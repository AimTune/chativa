import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";

export interface GenUIListItem {
  text: string;
  icon?: string;
  secondary?: string;
}

/**
 * `<genui-list>` — built-in list component for Generative UI streams.
 *
 * Expected props from connector:
 * ```json
 * {
 *   "title": "Key features",
 *   "ordered": false,
 *   "items": [
 *     { "text": "Real-time sync", "icon": "⚡" },
 *     { "text": "End-to-end encryption", "secondary": "AES-256" }
 *   ]
 * }
 * ```
 */
@customElement("genui-list")
export class GenUIList extends ChativaElement {
  static override styles = css`
    :host { display: block; }

    .list-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      max-width: 400px;
      font-family: inherit;
    }

    .list-title {
      margin: 0 0 12px;
      font-size: 0.9375rem;
      font-weight: 600;
      color: #0f172a;
    }

    ol, ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 10px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .item-icon {
      font-size: 1rem;
      line-height: 1.4;
      flex-shrink: 0;
      min-width: 20px;
      text-align: center;
    }

    .item-number {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--chativa-primary-color, #4f46e5);
      flex-shrink: 0;
      min-width: 20px;
      line-height: 1.4;
    }

    .item-body { flex: 1; min-width: 0; }

    .item-text {
      font-size: 0.875rem;
      color: #0f172a;
      line-height: 1.4;
    }

    .item-secondary {
      font-size: 0.75rem;
      color: #94a3b8;
      margin-top: 2px;
    }
  `;

  @property({ type: String }) title = "";
  @property({ type: Boolean }) ordered = false;
  @property({ type: Array }) items: GenUIListItem[] = [];

  private _renderItems() {
    return this.items.map((item, i) => html`
      <li>
        ${this.ordered
          ? html`<span class="item-number">${i + 1}.</span>`
          : item.icon
            ? html`<span class="item-icon" aria-hidden="true">${item.icon}</span>`
            : html`<span class="item-icon" aria-hidden="true">•</span>`}
        <div class="item-body">
          <div class="item-text">${item.text}</div>
          ${item.secondary ? html`<div class="item-secondary">${item.secondary}</div>` : nothing}
        </div>
      </li>
    `);
  }

  override render() {
    return html`
      <div class="list-container">
        ${this.title ? html`<h3 class="list-title">${this.title}</h3>` : nothing}
        ${this.ordered
          ? html`<ol>${this._renderItems()}</ol>`
          : html`<ul>${this._renderItems()}</ul>`}
      </div>
    `;
  }
}
