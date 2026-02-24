/**
 * EventBus — typed application event bus for analytics and observability hooks.
 *
 * @example Consumer (analytics, logging):
 * ```ts
 * import { EventBus } from "@chativa/core";
 *
 * EventBus.on("message_sent", (msg) => analytics.track("message_sent", msg));
 * EventBus.on("widget_opened", () => analytics.page("chat_opened"));
 * ```
 *
 * @example Internal emitter (ChatEngine, ChatStore):
 * ```ts
 * EventBus.emit("message_received", incomingMessage);
 * ```
 */
import type { OutgoingMessage, IncomingMessage } from "../domain/entities/Message";
import type { ConnectorStatus } from "./stores/ChatStore";

// ── Event payload map ──────────────────────────────────────────────────────────

export interface EventBusPayloadMap {
  /** Widget panel opened (chat-iva visible). */
  widget_opened: undefined;
  /** Widget panel closed. */
  widget_closed: undefined;
  /** User sent a message. */
  message_sent: OutgoingMessage;
  /** Bot/connector delivered a message. */
  message_received: IncomingMessage;
  /** User uploaded a file. */
  file_uploaded: { name: string; size: number };
  /** Connector connection state changed. */
  connector_status_changed: { status: ConnectorStatus };
  /** GenUI stream started (first chunk received). */
  genui_stream_started: { streamId: string };
  /** GenUI stream completed. */
  genui_stream_completed: { streamId: string };
  /** History page loaded. */
  history_loaded: { count: number };
  /** Search query updated (empty string = search cleared). */
  search_query_changed: { query: string };
}

export type EventBusEventName = keyof EventBusPayloadMap;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (payload: any) => void;

const _listeners = new Map<EventBusEventName, Set<AnyHandler>>();

export const EventBus = {
  on<K extends EventBusEventName>(
    event: K,
    handler: (payload: EventBusPayloadMap[K]) => void
  ): void {
    if (!_listeners.has(event)) {
      _listeners.set(event, new Set());
    }
    _listeners.get(event)!.add(handler as AnyHandler);
  },

  off<K extends EventBusEventName>(
    event: K,
    handler: (payload: EventBusPayloadMap[K]) => void
  ): void {
    _listeners.get(event)?.delete(handler as AnyHandler);
  },

  emit<K extends EventBusEventName>(
    event: K,
    payload: EventBusPayloadMap[K]
  ): void {
    _listeners.get(event)?.forEach((h) => h(payload));
  },

  /** Remove all listeners — use in tests only. */
  clear(): void {
    _listeners.clear();
  },
} as const;
