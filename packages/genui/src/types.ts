/**
 * API injected by `GenUIMessage` into every registered custom component instance.
 *
 * Use this interface in your custom components to type the injected properties:
 *
 * ```ts
 * import type { GenUIComponentAPI } from "@chativa/genui";
 *
 * class MyWidget extends LitElement implements Partial<GenUIComponentAPI> {
 *   sendEvent?: GenUIComponentAPI["sendEvent"];
 *   listenEvent?: GenUIComponentAPI["listenEvent"];
 *   tFn?: GenUIComponentAPI["tFn"];
 *   onLangChange?: GenUIComponentAPI["onLangChange"];
 * }
 * ```
 */
export interface GenUIComponentAPI {
  /** Send an event to the connector (e.g. `"form_submit"`, `"rating_submit"`). */
  sendEvent(type: string, payload: unknown): void;
  /** Listen for a server-originated event within this message scope. */
  listenEvent(type: string, cb: (payload: unknown) => void): void;
  /**
   * Translate a key using the shared i18next instance.
   * Falls back to `fallback` if the key is not found.
   * Named `tFn` (not `translate`) to avoid conflict with the native
   * `HTMLElement.translate` boolean attribute.
   */
  tFn(key: string, fallback?: string): string;
  /**
   * Subscribe to locale changes so you can call `requestUpdate()`.
   * Returns an unsubscribe function — call it in `disconnectedCallback`.
   */
  onLangChange(cb: () => void): () => void;
}
