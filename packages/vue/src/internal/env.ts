/**
 * True only in a real browser-like environment that can host custom elements.
 * False during Vue/Nuxt server rendering, where `window` / `customElements`
 * don't exist — every DOM-touching code path in this package is gated on it.
 *
 * `window` is checked as well as `customElements` because Lit's Node build
 * installs a server-side `customElements` shim on `globalThis`, so that one
 * alone is not proof of a browser.
 */
export function canUseDOM(): boolean {
  return typeof window !== "undefined" && typeof customElements !== "undefined";
}
