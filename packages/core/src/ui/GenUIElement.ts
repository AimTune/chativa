import type { GenUIComponentAPI, GenUIEventOptions } from "../domain/entities/GenUI";
import { ChativaElement } from "./ChativaElement";
import { i18next, t } from "./I18nMixin";

/** Event name used by the fallback `sendEvent` when no host injected one. */
export const GENUI_COMPONENT_EVENT = "genui-component-event";

/** `detail` shape of the {@link GENUI_COMPONENT_EVENT} fallback event. */
export interface GenUIComponentEventDetail extends GenUIEventOptions {
  eventType: string;
  payload: unknown;
}

/**
 * `GenUIElement` — base class for Generative UI components.
 *
 * Extend this instead of `LitElement` when you build a component that a
 * connector streams as a `{ type: "ui" }` chunk. On top of `ChativaElement`
 * (i18n + auto re-render on locale switch) it implements the whole
 * `GenUIComponentAPI` with working defaults, so `this.sendEvent(...)`,
 * `this.listenEvent(...)` and `this.tFn(...)` are always callable — no
 * optional-chaining, no four lines of injected-property boilerplate.
 *
 * When the component is mounted by `GenUIMessage`, the host assigns its own
 * message-scoped `sendEvent` / `listenEvent` / `tFn` / `onLangChange` as own
 * properties, which shadow these prototype defaults. Outside a chat message
 * (standalone page, Storybook, unit test) the defaults keep the component
 * functional:
 *
 * - `sendEvent`   → dispatches a bubbling, composed `genui-component-event`
 * - `listenEvent` → registers locally; deliver with `receiveEvent(type, payload)`
 * - `tFn`         → the shared i18next instance
 * - `onLangChange`→ the shared i18next instance
 *
 * @example
 * ```ts
 * import { GenUIElement } from "@chativa/core";
 * import { html, css } from "lit";
 * import { customElement, property } from "lit/decorators.js";
 *
 * @customElement("weather-widget")
 * export class WeatherWidget extends GenUIElement {
 *   static override styles = css`:host { display: block; }`;
 *
 *   @property({ type: String }) city = "";
 *   @property({ type: Number }) temp = 0;
 *
 *   override connectedCallback() {
 *     super.connectedCallback();
 *     this.listenEvent("weather_updated", (p) => {
 *       this.temp = (p as { temp: number }).temp;
 *     });
 *   }
 *
 *   override render() {
 *     return html`
 *       <h3>${this.city} · ${this.temp}°C</h3>
 *       <button @click=${() => this.sendEvent("refresh_weather", { city: this.city })}>
 *         ${this.tFn("widget.refresh", "Refresh")}
 *       </button>
 *     `;
 *   }
 * }
 *
 * GenUIRegistry.register("weather", WeatherWidget);
 * ```
 *
 * Note: do NOT redeclare `sendEvent` / `listenEvent` / `tFn` / `onLangChange`
 * as class fields in the subclass — that shadows the defaults with `undefined`.
 */
export class GenUIElement extends ChativaElement implements GenUIComponentAPI {
  /**
   * Listeners registered through the default `listenEvent`. Unused when a host
   * injects its own implementation.
   */
  private _localListeners = new Map<string, Set<(payload: unknown) => void>>();

  /**
   * Send an event to the connector.
   *
   * Replaced by `GenUIMessage` with a message-scoped version that routes to
   * `IConnector.receiveComponentEvent`. The default dispatches a bubbling,
   * composed `genui-component-event` so a plain host page can still react.
   */
  sendEvent(type: string, payload: unknown, opts?: GenUIEventOptions): void {
    this.dispatchEvent(
      new CustomEvent<GenUIComponentEventDetail>(GENUI_COMPONENT_EVENT, {
        detail: { eventType: type, payload, ...opts },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Subscribe to a server-originated event.
   *
   * Replaced by `GenUIMessage` with a version scoped to this message bubble.
   * The default keeps listeners locally — feed them with `receiveEvent()`.
   */
  listenEvent(type: string, cb: (payload: unknown) => void): void {
    let set = this._localListeners.get(type);
    if (!set) {
      set = new Set();
      this._localListeners.set(type, set);
    }
    set.add(cb);
  }

  /**
   * Deliver an event to listeners registered through the *default*
   * `listenEvent`. Useful in tests and standalone hosts; a no-op once
   * `GenUIMessage` has injected its own `listenEvent`.
   */
  receiveEvent(type: string, payload?: unknown): void {
    this._localListeners.get(type)?.forEach((cb) => cb(payload));
  }

  /**
   * Translate a key, falling back to `fallback` (then the key itself).
   *
   * Named `tFn` — not `translate` — because `HTMLElement.translate` is a native
   * boolean attribute. `this.t(key, options)` from `ChativaElement` is also
   * available when you need full i18next options.
   */
  tFn(key: string, fallback?: string): string {
    return t(key, { defaultValue: fallback ?? key }) as string;
  }

  /**
   * Subscribe to locale changes; returns an unsubscribe function.
   *
   * Subclasses rarely need this — `ChativaElement` already re-renders on
   * `languageChanged`. It exists so the injected API stays complete.
   */
  onLangChange(cb: () => void): () => void {
    i18next.on("languageChanged", cb);
    return () => {
      i18next.off("languageChanged", cb);
    };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._localListeners.clear();
  }
}
