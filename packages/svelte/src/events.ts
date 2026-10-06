import { EventBus, type EventBusEventName, type EventBusPayloadMap } from "@chativa/core";
import { isBrowser } from "./internal/env.js";

/**
 * Subscribe to a Chativa `EventBus` event and get back the unsubscribe
 * function. The return value is shaped to be returned straight from a
 * Svelte `$effect` (or `onMount`), which then cleans the listener up when
 * the component is destroyed. A no-op on the server.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { onChativaEvent } from "@chativa/svelte";
 *
 *   $effect(() => onChativaEvent("message_sent", (message) => console.log(message)));
 * </script>
 * ```
 */
export function onChativaEvent<K extends EventBusEventName>(
  event: K,
  handler: (payload: EventBusPayloadMap[K]) => void,
): () => void {
  if (!isBrowser()) return () => {};
  EventBus.on(event, handler);
  return () => EventBus.off(event, handler);
}
