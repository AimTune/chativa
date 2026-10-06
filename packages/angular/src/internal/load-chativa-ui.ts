/**
 * Client-only, memoized loader for `@chativa/ui`.
 *
 * `@chativa/ui` registers its custom elements (`<chat-iva>`,
 * `<chat-bot-button>`, `<genui-message>`, …) and touches `customElements` /
 * `document` as *module-level side effects*, so it must never be imported
 * eagerly from a module that Angular SSR evaluates on the server. Every
 * wrapper routes the load through this `import()` and only calls it on the
 * browser platform.
 *
 * `<genui-message>` is loaded through `@chativa/ui` too: the UI package
 * imports `@chativa/genui` for its side effects, so going through it keeps a
 * single copy of the GenUI custom elements and saves consumers an extra
 * dependency.
 */
let uiPromise: Promise<unknown> | null = null;

export function loadChativaUi(): Promise<unknown> {
  if (!uiPromise) uiPromise = import("@chativa/ui");
  return uiPromise;
}
