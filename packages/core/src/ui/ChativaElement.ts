import { LitElement } from "lit";
import { I18nMixin } from "./I18nMixin";

/**
 * `ChativaElement` — base class for all Chativa LitElement components.
 *
 * Extend this instead of `LitElement` to get:
 * - `this.t(key, options?)` — i18n translation helper
 * - Automatic re-render on `i18next.changeLanguage()`
 *
 * @example
 * ```ts
 * import { ChativaElement } from "@chativa/core";
 * import { customElement } from "lit/decorators.js";
 *
 * @customElement("my-element")
 * class MyElement extends ChativaElement {
 *   override render() {
 *     return html`<p>${this.t("my.key", { defaultValue: "Hello" })}</p>`;
 *   }
 * }
 * ```
 */
export class ChativaElement extends I18nMixin(LitElement) {}
