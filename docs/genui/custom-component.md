# Custom GenUI Component

Anything you can build as a LitElement can be a GenUI component. Register it once; bots can stream it forever.

```ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { GenUIRegistry, type GenUIComponentAPI } from "@chativa/genui";

@customElement("weather-widget")
export class WeatherWidget extends LitElement {
  // Injected by GenUIMessage at mount time:
  sendEvent?: GenUIComponentAPI["sendEvent"];
  listenEvent?: GenUIComponentAPI["listenEvent"];
  tFn?: GenUIComponentAPI["tFn"];
  onLangChange?: GenUIComponentAPI["onLangChange"];

  @property({ type: String })  city = "";
  @property({ type: Number })  temp = 0;
  @property({ type: String })  condition = "";

  private _unsubLang?: () => void;

  connectedCallback() {
    super.connectedCallback();
    // Re-render on locale switch so tFn returns the new language
    this._unsubLang = this.onLangChange?.(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubLang?.();
  }

  static styles = css`
    :host { display: block; }
    .card {
      border: 1px solid var(--chativa-border-color);
      border-radius: 12px; padding: 12px;
    }
  `;

  private _refresh() {
    // Echo back to the connector — connector receives this via receiveComponentEvent
    this.sendEvent?.("refresh_weather", { city: this.city });
  }

  render() {
    const refresh = this.tFn?.("widget.refresh", "Refresh") ?? "Refresh";
    return html`
      <div class="card">
        <h3>${this.city}</h3>
        <p>${this.temp}°C · ${this.condition}</p>
        <button @click=${this._refresh}>${refresh}</button>
      </div>
    `;
  }
}

// Side-effect register
GenUIRegistry.register("weather", WeatherWidget);
```

Then a connector can stream it as `{ type: "ui", component: "weather", props: { city, temp, condition } }`.

## The injected API

`GenUIMessage` injects four methods at mount time:

| Method | Purpose |
|---|---|
| `sendEvent(type, payload)` | Send to the connector via `IConnector.receiveComponentEvent`. |
| `listenEvent(type, cb)` | Subscribe to event chunks targeting this component (`for === this.id`) or broadcast events. |
| `tFn(key, fallback?)` | i18next translation. |
| `onLangChange(cb)` | Subscribe to locale changes. Returns an unsubscribe function. |

## Naming convention

- Built-in components are namespaced `genui-<thing>` (kebab-case). For your own widgets, any unique custom-element-compatible name works; just stay consistent across registrations.
- Don't expose a `translate` property on your component — `HTMLElement.translate` collides. Always use `tFn`.

## Don't extend ChatbotMixin

GenUI components are standalone — they don't share the chat widget's mixin chain. They get the i18n hook via the `tFn` injection, not via `I18nMixin`.

## See also

- [Streaming protocol](./streaming.md) — chunks, event routing, `receiveComponentEvent`.
- Built-in source examples — [`packages/genui/src/components/`](../../packages/genui/src/components/) — copy/paste any of them as a starting template.
