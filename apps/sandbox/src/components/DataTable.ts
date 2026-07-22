import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

/**
 * `<data-table>` — Sandbox Generative UI component for the mekik SQL analyst demo.
 * Register with: `GenUIRegistry.register("data-table", DataTable)`
 *
 * Props emitted by the graph's `mekik.ui("data-table", { … })`:
 * ```json
 * {
 *   "columns": ["name", "dollars"],
 *   "rows": [{ "name": "Grace Hopper", "dollars": 724.4 }],
 *   "sql": "SELECT …"
 * }
 * ```
 *
 * The agent writes its own SQL, so neither the column set nor the row shape is
 * known ahead of time — everything here is driven off `columns`. Values are
 * rendered as text; the graph is responsible for masking anything private
 * before it emits the chunk (a `redact` policy only covers `tool_call` frames,
 * never a `genui` chunk a tool emits itself).
 */
@customElement("data-table")
export class DataTable extends LitElement {
  static override styles = css`
    :host { display: block; }

    .wrap {
      border-radius: 14px;
      overflow: hidden;
      max-width: 460px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.3);
    }

    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 14px;
      background: rgba(148, 163, 184, 0.12);
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #94a3b8;
    }

    .scroll { overflow-x: auto; max-height: 320px; overflow-y: auto; }

    table { border-collapse: collapse; width: 100%; font-size: 0.82rem; }

    th, td {
      text-align: left;
      padding: 8px 14px;
      white-space: nowrap;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
    }

    th {
      position: sticky;
      top: 0;
      background: #1e293b;
      font-weight: 600;
      color: #cbd5e1;
    }

    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: rgba(148, 163, 184, 0.08); }

    /* Numbers read far better right-aligned and tabular. */
    td.num { text-align: right; font-variant-numeric: tabular-nums; }

    .redacted { opacity: 0.55; font-style: italic; }

    .empty { padding: 18px 14px; font-size: 0.85rem; color: #94a3b8; }

    .sql-toggle {
      background: none;
      border: none;
      color: #94a3b8;
      font: inherit;
      font-size: 0.68rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      padding: 0;
    }
    .sql-toggle:hover { color: #e2e8f0; }

    pre.sql {
      margin: 0;
      padding: 12px 14px;
      background: #020617;
      color: #7dd3fc;
      font-size: 0.75rem;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      border-top: 1px solid rgba(148, 163, 184, 0.14);
    }
  `;

  @property({ type: Array }) columns: string[] = [];
  @property({ type: Array }) rows: Record<string, unknown>[] = [];
  @property({ type: String }) sql = "";

  @state() private _showSql = false;

  /** Fall back to the first row's keys if the graph did not send `columns`. */
  private get _columns(): string[] {
    if (this.columns.length > 0) return this.columns;
    return this.rows.length > 0 ? Object.keys(this.rows[0]) : [];
  }

  private _cell(value: unknown) {
    if (value === null || value === undefined) return html`<span class="redacted">—</span>`;
    const text = String(value);
    // The graph masks private fields before emitting; show that it did.
    if (text === "«redacted»") return html`<span class="redacted">${text}</span>`;
    return text;
  }

  override render() {
    const columns = this._columns;

    return html`
      <div class="wrap">
        <div class="head">
          <span>▦ ${this.rows.length} row${this.rows.length === 1 ? "" : "s"}</span>
          ${this.sql
            ? html`<button
                class="sql-toggle"
                @click=${() => (this._showSql = !this._showSql)}
              >
                ${this._showSql ? "hide sql" : "show sql"}
              </button>`
            : nothing}
        </div>

        ${columns.length === 0
          ? html`<div class="empty">The query returned no rows.</div>`
          : html`
              <div class="scroll">
                <table>
                  <thead>
                    <tr>
                      ${columns.map((c) => html`<th>${c}</th>`)}
                    </tr>
                  </thead>
                  <tbody>
                    ${this.rows.map(
                      (row) => html`
                        <tr>
                          ${columns.map((c) => {
                            const value = row[c];
                            return html`<td class=${typeof value === "number" ? "num" : ""}>
                              ${this._cell(value)}
                            </td>`;
                          })}
                        </tr>
                      `
                    )}
                  </tbody>
                </table>
              </div>
            `}

        ${this._showSql && this.sql ? html`<pre class="sql">${this.sql}</pre>` : nothing}
      </div>
    `;
  }
}
