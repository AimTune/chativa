import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

const ICONS: Record<string, string> = {
  sunny:        "☀️",
  clear:        "🌙",
  cloudy:       "☁️",
  "partly cloudy": "⛅",
  rain:         "🌧️",
  drizzle:      "🌦️",
  snow:         "❄️",
  storm:        "⛈️",
  windy:        "💨",
  fog:          "🌫️",
  default:      "🌡️",
};

function getIcon(condition: string): string {
  const key = condition.toLowerCase();
  for (const [k, v] of Object.entries(ICONS)) {
    if (key.includes(k)) return v;
  }
  return ICONS.default;
}

/**
 * `<weather-widget>` — Sandbox demo Generative UI component.
 * Register with: `GenUIRegistry.register("weather", WeatherWidget)`
 *
 * Expected props from connector:
 * ```json
 * { "city": "Istanbul", "country": "TR", "temp": 22,
 *   "condition": "Partly Cloudy", "humidity": 65, "wind": 12 }
 * ```
 */
@customElement("weather-widget")
export class WeatherWidget extends LitElement {
  static override styles = css`
    :host { display: block; }

    .card {
      border-radius: 16px;
      overflow: hidden;
      max-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
      color: white;
      box-shadow: 0 8px 24px rgba(14, 165, 233, 0.35);
    }

    .card-main {
      padding: 20px 22px 16px;
    }

    .location {
      font-size: 0.8125rem;
      font-weight: 500;
      opacity: 0.85;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .temp-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 6px;
    }

    .icon {
      font-size: 3rem;
      line-height: 1;
    }

    .temp {
      font-size: 3.25rem;
      font-weight: 700;
      line-height: 1;
    }

    .unit {
      font-size: 1.25rem;
      font-weight: 400;
      opacity: 0.8;
      margin-top: 4px;
    }

    .condition {
      font-size: 1rem;
      font-weight: 500;
      opacity: 0.9;
      margin-bottom: 0;
    }

    .card-footer {
      padding: 10px 22px 16px;
      display: flex;
      gap: 20px;
      background: rgba(0, 0, 0, 0.1);
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-label {
      font-size: 0.6875rem;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-value {
      font-size: 0.875rem;
      font-weight: 600;
    }
  `;

  @property({ type: String }) city = "";
  @property({ type: String }) country = "";
  @property({ type: Number }) temp = 0;
  @property({ type: String }) unit = "C";
  @property({ type: String }) condition = "";
  @property({ type: Number }) humidity = 0;
  @property({ type: Number }) wind = 0;
  @property({ type: String }) windUnit = "km/h";

  override render() {
    const icon = getIcon(this.condition);

    return html`
      <div class="card">
        <div class="card-main">
          <div class="location">
            📍 ${this.city}${this.country ? html`, ${this.country}` : nothing}
          </div>
          <div class="temp-row">
            <div class="icon">${icon}</div>
            <div>
              <div class="temp">
                ${this.temp}<span class="unit">°${this.unit}</span>
              </div>
            </div>
          </div>
          <div class="condition">${this.condition}</div>
        </div>
        ${(this.humidity > 0 || this.wind > 0) ? html`
          <div class="card-footer">
            ${this.humidity > 0 ? html`
              <div class="stat">
                <span class="stat-label">Humidity</span>
                <span class="stat-value">${this.humidity}%</span>
              </div>
            ` : nothing}
            ${this.wind > 0 ? html`
              <div class="stat">
                <span class="stat-label">Wind</span>
                <span class="stat-value">${this.wind} ${this.windUnit}</span>
              </div>
            ` : nothing}
          </div>
        ` : nothing}
      </div>
    `;
  }
}
