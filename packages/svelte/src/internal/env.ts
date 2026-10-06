/**
 * True when running in a browser (or a DOM-backed test environment).
 *
 * Deliberately a runtime check rather than `esm-env`'s build-time `BROWSER`
 * constant: SvelteKit evaluates this package on the server during SSR /
 * prerendering, and `@chativa/ui` / `@chativa/genui` define custom elements
 * as module-level side effects, so they may only be imported once a real
 * `window` + `customElements` registry exists.
 */
export function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof customElements !== "undefined"
  );
}
