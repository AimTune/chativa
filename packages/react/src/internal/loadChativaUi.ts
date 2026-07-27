/**
 * Client-only, memoized loaders for `@chativa/ui` / `@chativa/genui`.
 *
 * Both packages register custom elements (and touch `customElements` /
 * `document`) as *module-level side effects*, so they must never be
 * imported eagerly from a module that a server bundler evaluates during
 * SSR. Every load is routed through `import()` inside a browser-only
 * effect — see `createLazyElementComponent`.
 */

let uiPromise: Promise<typeof import("@chativa/ui")> | null = null;
export function loadChativaUi(): Promise<typeof import("@chativa/ui")> {
  if (!uiPromise) uiPromise = import("@chativa/ui");
  return uiPromise;
}

let genuiPromise: Promise<typeof import("@chativa/genui")> | null = null;
export function loadChativaGenUi(): Promise<typeof import("@chativa/genui")> {
  if (!genuiPromise) genuiPromise = import("@chativa/genui");
  return genuiPromise;
}
