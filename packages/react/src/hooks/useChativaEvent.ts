"use client";

import { useEffect, useRef } from "react";
import { EventBus, type EventBusEventName, type EventBusPayloadMap } from "@chativa/core";

/**
 * Subscribe to a Chativa `EventBus` event for the lifetime of the calling
 * component. The subscription is created once per `event` name — passing a
 * new `handler` identity on every render (the common case for inline arrow
 * functions) does not tear down and re-create it; the latest `handler` is
 * always the one invoked.
 *
 * @example
 * ```tsx
 * useChativaEvent("message_received", (message) => console.log(message));
 * ```
 */
export function useChativaEvent<K extends EventBusEventName>(
  event: K,
  handler: ((payload: EventBusPayloadMap[K]) => void) | undefined,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!handler) return;
    const listener = (payload: EventBusPayloadMap[K]) => handlerRef.current?.(payload);
    EventBus.on(event, listener);
    return () => EventBus.off(event, listener);
  }, [event, !!handler]);
}
