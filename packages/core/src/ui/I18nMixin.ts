import { LitElement } from "lit";
import i18next from "i18next";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = object> = new (...args: any[]) => T;

/**
 * `I18nMixin` — shared i18n base for all Chativa LitElement components.
 *
 * - Subscribes to `i18next.on("languageChanged")` → calls `requestUpdate()`
 *   so the component re-renders on locale switch.
 * - Provides a `t(key, options?)` protected method as a thin wrapper around
 *   the global i18next `t` function.
 *
 * Used by both `@chativa/ui` (via ChatbotMixin) and `@chativa/genui` components
 * so neither package needs its own i18next subscription boilerplate.
 *
 * @example
 * ```ts
 * import { I18nMixin } from "@chativa/core";
 * import { LitElement } from "lit";
 * import { customElement } from "lit/decorators.js";
 *
 * @customElement("my-element")
 * class MyElement extends I18nMixin(LitElement) {
 *   override render() {
 *     return html`<p>${this.t("my.key", { defaultValue: "Hello" })}</p>`;
 *   }
 * }
 * ```
 */
export const I18nMixin = <T extends Constructor<LitElement>>(superClass: T) => {
  class I18nClass extends superClass {
    private _i18nLangChangeHandler = () => { this.requestUpdate(); };

    override connectedCallback() {
      super.connectedCallback();
      i18next.on("languageChanged", this._i18nLangChangeHandler);
    }

    override disconnectedCallback() {
      i18next.off("languageChanged", this._i18nLangChangeHandler);
      super.disconnectedCallback();
    }

    /** Translate a key using the shared i18next instance. */
    protected t(key: string, options?: Record<string, unknown>): string {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return i18next.t(key, options as any) as string;
    }
  }

  return I18nClass as unknown as Constructor<
    LitElement & { t(key: string, options?: Record<string, unknown>): string }
  > & T;
};

/** The shared i18next instance — re-exported for convenience. */
export { i18next };
export { t } from "i18next";
