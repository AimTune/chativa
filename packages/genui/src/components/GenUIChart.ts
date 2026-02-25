import { html, css, nothing, svg } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";

export interface GenUIDataset {
  label?: string;
  data: number[];
  color?: string;
}

const PALETTE = ["#4f46e5", "#7c3aed", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

/**
 * GenUIChart — zero-dependency chart component (bar / line / pie) built with SVG + CSS.
 *
 * Registered as "genui-chart" in GenUIRegistry.
 *
 * @example (AIChunk)
 * ```json
 * { "type": "ui", "component": "genui-chart", "props": {
 *   "type": "bar",
 *   "title": "Monthly Sales",
 *   "labels": ["Jan", "Feb", "Mar"],
 *   "datasets": [{ "label": "Revenue", "data": [120, 95, 140] }]
 * }}
 * ```
 */
@customElement("genui-chart")
export class GenUIChart extends ChativaElement {
  static override styles = css`
    :host {
      display: block;
    }

    .chart-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      max-width: 420px;
      font-family: inherit;
    }

    .chart-title {
      margin: 0 0 14px;
      font-size: 0.9375rem;
      font-weight: 600;
      color: #0f172a;
    }

    /* Bar chart */
    .bar-chart {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      height: 160px;
    }

    .bar-group {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      height: 100%;
      justify-content: flex-end;
      min-width: 0;
    }

    .bars {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      width: 100%;
      height: calc(100% - 18px);
    }

    .bar {
      flex: 1;
      border-radius: 3px 3px 0 0;
      min-height: 2px;
      transition: opacity 0.15s;
    }

    .bar:hover {
      opacity: 0.8;
    }

    .bar-label {
      font-size: 0.625rem;
      color: #64748b;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
      flex-shrink: 0;
    }

    /* Legend */
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      margin-top: 12px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.75rem;
      color: #475569;
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* SVG charts */
    svg {
      width: 100%;
      display: block;
      overflow: visible;
    }
  `;

  /** Chart variant. Default: "bar". */
  @property({ type: String }) type: "bar" | "line" | "pie" = "bar";
  /** Optional title displayed above the chart. */
  @property({ type: String }) title?: string;
  /** X-axis labels (one per data point). */
  @property({ type: Array }) labels?: string[];
  /** Data series. Each series has an optional label, data array, and optional color. */
  @property({ type: Array }) datasets?: GenUIDataset[];

  private _color(index: number, override?: string): string {
    return override ?? PALETTE[index % PALETTE.length];
  }

  // ── Bar chart ──────────────────────────────────────────────────────────────

  private _renderBar() {
    const datasets = this.datasets ?? [];
    const labels = this.labels ?? [];
    const allValues = datasets.flatMap((d) => d.data);
    const max = Math.max(...allValues, 1);
    const groupCount = Math.max(...datasets.map((d) => d.data.length), labels.length, 1);

    return html`
      <div class="bar-chart" role="img" aria-label=${this.title ?? "Bar chart"}>
        ${Array.from({ length: groupCount }, (_, gi) => html`
          <div class="bar-group">
            <div class="bars">
              ${datasets.map((ds, di) => {
                const val = ds.data[gi] ?? 0;
                const h = Math.max(Math.round((val / max) * 100), val > 0 ? 2 : 0);
                return html`
                  <div
                    class="bar"
                    style="height:${h}%;background:${this._color(di, ds.color)};"
                    title="${ds.label ? ds.label + ": " : ""}${val}"
                  ></div>
                `;
              })}
            </div>
            ${labels[gi] ? html`<span class="bar-label">${labels[gi]}</span>` : nothing}
          </div>
        `)}
      </div>
      ${this._renderLegend()}
    `;
  }

  // ── Line chart ─────────────────────────────────────────────────────────────

  private _renderLine() {
    const datasets = this.datasets ?? [];
    if (datasets.length === 0) return nothing;

    const W = 380, H = 150, PAD_X = 28, PAD_Y = 16;
    const allVals = datasets.flatMap((d) => d.data);
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals, minV + 1);
    const maxLen = Math.max(...datasets.map((d) => d.data.length), 2);
    const innerW = W - PAD_X * 2;
    const innerH = H - PAD_Y * 2;

    const xPos = (i: number) => PAD_X + (i / (maxLen - 1)) * innerW;
    const yPos = (v: number) => PAD_Y + ((maxV - v) / (maxV - minV)) * innerH;

    return html`
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label=${this.title ?? "Line chart"}>
        ${datasets.map((ds, di) => {
          const color = this._color(di, ds.color);
          const pts = ds.data.map((v, i) => `${xPos(i)},${yPos(v)}`).join(" ");
          return svg`
            <polyline
              points="${pts}"
              fill="none"
              stroke="${color}"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
            ${ds.data.map((v, i) => svg`
              <circle cx="${xPos(i)}" cy="${yPos(v)}" r="3.5" fill="${color}" />
            `)}
          `;
        })}
        ${(this.labels ?? []).map((lbl, i) => svg`
          <text
            x="${xPos(i)}"
            y="${H - 2}"
            text-anchor="middle"
            font-size="9"
            fill="#94a3b8"
          >${lbl}</text>
        `)}
      </svg>
      ${this._renderLegend()}
    `;
  }

  // ── Pie chart ──────────────────────────────────────────────────────────────

  private _renderPie() {
    const datasets = this.datasets ?? [];
    if (datasets.length === 0) return nothing;

    // Each dataset contributes its first value as its slice weight
    const values = datasets.map((d) => d.data[0] ?? 0);
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const R = 50, CX = 65, CY = 65;
    const circumference = 2 * Math.PI * R;
    let cumulativePercent = 0;

    return html`
      <svg viewBox="0 0 200 130" role="img" aria-label=${this.title ?? "Pie chart"}>
        ${datasets.map((ds, di) => {
          const pct = values[di] / total;
          const dashArray = `${pct * circumference} ${circumference}`;
          const rotation = cumulativePercent * 360 - 90;
          cumulativePercent += pct;
          const color = this._color(di, ds.color);
          return svg`
            <circle
              cx="${CX}"
              cy="${CY}"
              r="${R}"
              fill="none"
              stroke="${color}"
              stroke-width="22"
              stroke-dasharray="${dashArray}"
              transform="rotate(${rotation} ${CX} ${CY})"
            />
          `;
        })}
        ${datasets.map((ds, di) => {
          const color = this._color(di, ds.color);
          const y = 16 + di * 18;
          return svg`
            <circle cx="142" cy="${y}" r="5" fill="${color}" />
            <text x="152" y="${y + 4}" font-size="10" fill="#475569">${ds.label ?? ""}</text>
          `;
        })}
      </svg>
    `;
  }

  // ── Legend ─────────────────────────────────────────────────────────────────

  private _renderLegend() {
    const datasets = this.datasets ?? [];
    if (datasets.every((d) => !d.label)) return nothing;
    return html`
      <div class="legend">
        ${datasets.map((ds, di) => html`
          <span class="legend-item">
            <span class="legend-dot" style="background:${this._color(di, ds.color)};"></span>
            ${ds.label}
          </span>
        `)}
      </div>
    `;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  override render() {
    return html`
      <div class="chart-container">
        ${this.title ? html`<h3 class="chart-title">${this.title}</h3>` : nothing}
        ${this.type === "line"
          ? this._renderLine()
          : this.type === "pie"
            ? this._renderPie()
            : this._renderBar()}
      </div>
    `;
  }
}
