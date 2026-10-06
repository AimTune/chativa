import { onBeforeUnmount, onMounted } from "vue";
import { EventBus, type EventBusEventName, type EventBusPayloadMap } from "@chativa/core";

/**
 * Subscribe to a Chativa `EventBus` event for the lifetime of the calling
 * component. Must be called from `setup()` (Vue 2.7 composition API).
 *
 * The subscription is created in `onMounted`, which Vue never runs during
 * server-side rendering, and removed in `onBeforeUnmount`.
 *
 * @example
 * ```ts
 * setup() {
 *   useChativaEvent("message_received", (message) => console.log(message));
 * }
 * ```
 */
export function useChativaEvent<K extends EventBusEventName>(
  event: K,
  handler: (payload: EventBusPayloadMap[K]) => void,
): void {
  const listener = (payload: EventBusPayloadMap[K]) => handler(payload);
  onMounted(() => EventBus.on(event, listener));
  onBeforeUnmount(() => EventBus.off(event, listener));
}
