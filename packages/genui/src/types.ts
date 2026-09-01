/**
 * The GenUI component contract now lives in `@chativa/core` next to the
 * `GenUIElement` base class that implements it. Re-exported here so existing
 * `import type { GenUIComponentAPI } from "@chativa/genui"` keeps working.
 *
 * Prefer extending `GenUIElement` — it implements the whole API with working
 * defaults, so you don't declare the injected properties yourself:
 *
 * ```ts
 * import { GenUIElement } from "@chativa/core";
 *
 * class MyWidget extends GenUIElement {
 *   private _submit() { this.sendEvent("my_submit", { ok: true }); }
 * }
 * ```
 */
export type { GenUIComponentAPI } from "@chativa/core";
