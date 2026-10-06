import { isBrowser } from "./internal/env.js";
import { loadChativaUi } from "./internal/loadChativaUi.js";

/**
 * Register Chativa's custom elements (`<chat-iva>`, `<chat-bot-button>`,
 * `<genui-message>`, every built-in message type) on the client.
 *
 * Safe to call from anywhere, any number of times:
 * - On the server (SvelteKit SSR / prerender) it does nothing and resolves
 *   `false` — `@chativa/ui` is never imported there.
 * - In the browser it dynamically imports `@chativa/ui` once (memoized) and
 *   resolves `true` once every element is defined.
 *
 * The wrapper components call this themselves, so you only need it when you
 * render the raw `<chat-iva>` / `<chat-bot-button>` tags directly, or want
 * the elements defined before the first wrapper mounts.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { onMount } from "svelte";
 *   import { registerChativa } from "@chativa/svelte";
 *
 *   onMount(() => { void registerChativa(); });
 * </script>
 * ```
 */
export async function registerChativa(): Promise<boolean> {
  if (!isBrowser()) return false;
  await loadChativaUi();
  return true;
}
