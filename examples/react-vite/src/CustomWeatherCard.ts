import { GenUIRegistry } from "@chativa/genui";

/**
 * A custom Generative UI component written as a plain Custom Element — no
 * Lit, no React. `GenUIRegistry.register()` only requires a `typeof
 * HTMLElement`; the host (`<genui-message>`, inside `<ChatIva>`) constructs
 * it with `new Ctor()` and assigns props as plain JS properties
 * (`el.city = "Istanbul"`), not HTML attributes — so any class with that
 * shape works, regardless of what framework (if any) built it. That's the
 * point of this file: a GenUI component is authored once and renders the
 * same way no matter what the *host* app is.
 *
 * `DummyConnector.triggerGenUI("weather")` (and the `/genui-weather` chat
 * command) streams a `{ component: "weather", props: {...} }` chunk with
 * exactly this shape, matching what a real backend would send.
 */

const STYLE = `
  :host { display: block; }
  .card {
    max-width: 280px;
    padding: 18px 20px;
    border-radius: 14px;
    background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 8px 24px rgba(14, 165, 233, 0.35);
  }
  .location { font-size: 0.8125rem; opacity: 0.85; margin-bottom: 8px; }
  .temp { font-size: 2.75rem; font-weight: 700; line-height: 1; }
  .condition { margin-top: 4px; font-size: 0.9375rem; opacity: 0.9; }
  .stats { margin-top: 12px; display: flex; gap: 16px; font-size: 0.75rem; opacity: 0.85; }
`;

interface WeatherProps {
  city: string;
  country: string;
  temp: number;
  unit: string;
  condition: string;
  humidity: number;
  wind: number;
}

const DEFAULTS: WeatherProps = {
  city: "",
  country: "",
  temp: 0,
  unit: "C",
  condition: "",
  humidity: 0,
  wind: 0,
};

export class CustomWeatherCard extends HTMLElement {
  #state: WeatherProps = { ...DEFAULTS };
  #els: { location: HTMLElement; temp: HTMLElement; condition: HTMLElement; humidity: HTMLElement; wind: HTMLElement };

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="card">
        <div class="location"></div>
        <div class="temp"></div>
        <div class="condition"></div>
        <div class="stats"><span class="humidity"></span><span class="wind"></span></div>
      </div>
    `;
    // Query once — re-used by every #render() call. Text is always set via
    // `textContent` below (never innerHTML) so nothing here needs escaping,
    // even though this demo's data happens to be trusted.
    this.#els = {
      location: root.querySelector(".location")!,
      temp: root.querySelector(".temp")!,
      condition: root.querySelector(".condition")!,
      humidity: root.querySelector(".humidity")!,
      wind: root.querySelector(".wind")!,
    };

    // Define an accessor per prop so `Object.assign(el, chunk.props)` —
    // exactly what `<genui-message>` does to apply/update props — re-renders
    // on every assignment, including later updates to an already-connected
    // instance (e.g. a progressively streamed component, unlike this one-shot
    // weather card).
    for (const key of Object.keys(DEFAULTS) as (keyof WeatherProps)[]) {
      Object.defineProperty(this, key, {
        get: () => this.#state[key],
        set: (value) => {
          (this.#state[key] as unknown) = value;
          this.#render();
        },
      });
    }
  }

  connectedCallback() {
    this.#render();
  }

  #render() {
    const { city, country, temp, unit, condition, humidity, wind } = this.#state;
    this.#els.location.textContent = `📍 ${city}${country ? `, ${country}` : ""}`;
    this.#els.temp.textContent = `${temp}°${unit}`;
    this.#els.condition.textContent = condition;
    this.#els.humidity.textContent = `💧 ${humidity}%`;
    this.#els.wind.textContent = `💨 ${wind} km/h`;
  }
}

// A class extending HTMLElement can only be constructed with `new` — which
// is exactly what <genui-message> does — once it's been registered via
// customElements.define(); that part isn't optional, even though the tag
// name itself is never used in markup here. (`GenUIRegistry.register`'s key
// — "weather" — is a separate, unrelated name: what a GenUI chunk's
// `component` field must match, not a tag name.)
if (!customElements.get("demo-weather-card")) {
  customElements.define("demo-weather-card", CustomWeatherCard);
}

GenUIRegistry.register("weather", CustomWeatherCard);
