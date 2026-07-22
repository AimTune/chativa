import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

interface ForecastDay {
  date: string;
  summary: string;
  high: number | null;
  low: number | null;
  precipitationMm: number | null;
}

/**
 * `<weather-card>` — Sandbox Generative UI component for the mekik weather demo.
 * Register with: `GenUIRegistry.register("weather-card", WeatherCard)`
 *
 * Props emitted by the graph's `mekik.ui("weather-card", { … })`:
 * ```json
 * {
 *   "place": "Istanbul",
 *   "days": [{ "date": "2026-07-21", "summary": "clear", "high": 31.4, "low": 23, "precipitationMm": 0 }]
 * }
 * ```
 *
 * Distinct from the older `<weather-widget>`, which shows one current reading for
 * a city. This one is a multi-day strip, and the agent emits one card per place —
 * so a "compare Istanbul and Berlin" turn renders two of them side by side.
 */
@customElement("weather-card")
export class WeatherCard extends LitElement {
  static override styles = css`
    :host { display: block; }

    .card {
      border-radius: 16px;
      overflow: hidden;
      max-width: 340px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
      color: white;
      box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35);
    }

    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      padding: 16px 18px 12px;
    }

    .place { font-size: 1.15rem; font-weight: 700; }

    .span {
      font-size: 0.7rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.8;
    }

    .days {
      list-style: none;
      margin: 0;
      padding: 0;
      background: rgba(0, 0, 0, 0.14);
    }

    .day {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 10px;
      padding: 10px 18px;
      font-size: 0.85rem;
    }

    .day + .day { border-top: 1px solid rgba(255, 255, 255, 0.12); }

    .when { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .weekday { font-weight: 600; }
    .summary {
      font-size: 0.75rem;
      opacity: 0.85;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rain {
      font-size: 0.72rem;
      opacity: 0.85;
      font-variant-numeric: tabular-nums;
      min-width: 3.2em;
      text-align: right;
    }
    .rain.dry { opacity: 0.35; }

    .temps { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .temps .low { opacity: 0.65; }
  `;

  @property({ type: String }) place = "";
  @property({ type: Array }) days: ForecastDay[] = [];

  /** WMO summaries the graph already resolved to words; map them to a glyph. */
  private _icon(summary: string): string {
    const s = summary.toLowerCase();
    if (s.includes("thunder")) return "⛈️";
    if (s.includes("snow")) return "🌨️";
    if (s.includes("rain") || s.includes("drizzle") || s.includes("shower")) return "🌧️";
    if (s.includes("fog")) return "🌫️";
    if (s.includes("overcast")) return "☁️";
    if (s.includes("cloud")) return "⛅";
    if (s.includes("clear")) return "☀️";
    return "🌡️";
  }

  private _weekday(date: string): string {
    const parsed = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsed.getTime())
      ? date
      : parsed.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  }

  private _temp(value: number | null): string {
    return value === null || value === undefined ? "–" : `${Math.round(value)}°`;
  }

  override render() {
    return html`
      <div class="card">
        <div class="head">
          <span class="place">${this.place}</span>
          <span class="span">${this.days.length} day${this.days.length === 1 ? "" : "s"}</span>
        </div>
        <ul class="days">
          ${this.days.map(
            (day) => html`
              <li class="day">
                <span class="when">
                  <span class="weekday">${this._icon(day.summary)} ${this._weekday(day.date)}</span>
                  <span class="summary">${day.summary}</span>
                </span>
                <span class="rain ${(day.precipitationMm ?? 0) > 0 ? "" : "dry"}">
                  ${(day.precipitationMm ?? 0) > 0 ? `${day.precipitationMm} mm` : "—"}
                </span>
                <span class="temps">
                  ${this._temp(day.high)} <span class="low">/ ${this._temp(day.low)}</span>
                </span>
              </li>
            `
          )}
        </ul>
      </div>
    `;
  }
}
