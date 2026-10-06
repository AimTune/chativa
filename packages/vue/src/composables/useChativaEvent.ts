import { getCurrentScope, onScopeDispose } from "vue";
import { EventBus, type EventBusEventName, type EventBusPayloadMap } from "@chativa/core";
import { canUseDOM } from "../internal/env";

/**
 * Subscribe to a Chativa `EventBus` event for the lifetime of the calling
 * effect scope (usually a component's `setup()`). The listener is removed
 * automatically when the scope is disposed; the returned function removes it
 * early.
 *
 * A no-op during server rendering — nothing is emitted there, and Nuxt never
 * disposes server-side component scopes, so subscribing would leak.
 *
 * @example
 * ```ts
 * useChativaEvent("message_received", (message) => console.log(message));
 * ```
 */
export function useChativaEvent<K extends EventBusEventName>(
  event: K,
  handler: (payload: EventBusPayloadMap[K]) => void,
): () => void {
  if (!canUseDOM()) return () => {};
  const listener = (payload: EventBusPayloadMap[K]) => handler(payload);
  EventBus.on(event, listener);
  const stop = () => EventBus.off(event, listener);
  if (getCurrentScope()) onScopeDispose(stop);
  return stop;
}
