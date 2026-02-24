import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";

/**
 * `<genui-table>` — built-in table component for Generative UI streams.
 *
 * Expected props from connector:
 * ```json
 * {
 *   "title": "Pricing comparison",
 *   "columns": ["Plan", "Price", "Storage"],
 *   "rows": [
 *     ["Free", "$0/mo", "5 GB"],
 *     ["Pro",  "$12/mo", "100 GB"]
 *   ]
 * }
 * ```
 *
 * For key-value tables, omit `columns` and use 2-column rows:
 * ```json
 * { "rows": [["Name", "Jane Doe"], ["Email", "jane@example.com"]] }
 * ```
 */
@customElement("genui-table")
export class GenUITable extends ChativaElement {
  static override styles = css`
    :host { display: block; }

    .table-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      max-width: 480px;
      font-family: inherit;
    }

    .scroll-wrapper {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .table-title {
      padding: 14px 16px 0;
      margin: 0 0 10px;
      font-size: 0.9375rem;
      font-weight: 600;
      color: #0f172a;
    }

    table {
      width: max-content;
      min-width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    thead th {
      background: #f1f5f9;
      padding: 9px 14px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }

    tbody tr:nth-child(even) td {
      background: #f8fafc;
    }

    tbody td {
      padding: 9px 14px;
      color: #0f172a;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }

    tbody tr:last-child td { border-bottom: none; }

    /* Key-value mode (2 columns, no header) */
    .kv-key {
      font-weight: 500;
      color: #64748b;
      width: 40%;
    }
  `;

  @property({ type: String }) title = "";
  @property({ type: Array }) columns: string[] = [];
  @property({ type: Array }) rows: (string | number)[][] = [];

  override render() {
    const isKeyValue = this.columns.length === 0 && this.rows.every((r) => r.length === 2);
    return html`
      <div class="table-container">
        ${this.title ? html`<h3 class="table-title">${this.title}</h3>` : nothing}
        <div class="scroll-wrapper">
        <table>
          ${this.columns.length > 0 ? html`
            <thead>
              <tr>
                ${this.columns.map((col) => html`<th scope="col">${col}</th>`)}
              </tr>
            </thead>
          ` : nothing}
          <tbody>
            ${this.rows.map((row) => html`
              <tr>
                ${row.map((cell, i) => html`
                  <td class=${isKeyValue && i === 0 ? "kv-key" : ""}>${cell}</td>
                `)}
              </tr>
            `)}
          </tbody>
        </table>
        </div>
      </div>
    `;
  }
}
