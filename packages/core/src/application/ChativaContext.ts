/**
 * ChativaContext — a curated facade over internal stores,
 * injected into connectors so event handlers can interact
 * with the chat UI without importing stores directly.
 */

import type { StoredMessage } from "./stores/MessageStore";
import type { ConnectorStatus, TypingOptions } from "./stores/ChatStore";
import type { ThemeConfig, DeepPartial } from "../domain/value-objects/Theme";
import type { EventBusEventName, EventBusPayloadMap } from "./EventBus";

export interface ChativaContext {
  /** Message operations. */
  messages: {
    add(msg: StoredMessage): void;
    update(id: string, patch: Partial<StoredMessage>): void;
    remove(id: string): void;
    clear(): void;
    getAll(): StoredMessage[];
  };

  /** Chat UI state operations. */
  chat: {
    open(): void;
    close(): void;
    toggle(): void;
    setTyping(v: boolean, opts?: TypingOptions): void;
    setFullscreen(v: boolean): void;
    getStatus(): ConnectorStatus;
    isOpened(): boolean;
  };

  /** Theme operations. */
  theme: {
    get(): ThemeConfig;
    set(overrides: DeepPartial<ThemeConfig>): void;
  };

  /** Application-level event bus. */
  events: {
    on<K extends EventBusEventName>(
      event: K,
      handler: (payload: EventBusPayloadMap[K]) => void,
    ): void;
    off<K extends EventBusEventName>(
      event: K,
      handler: (payload: EventBusPayloadMap[K]) => void,
    ): void;
    emit<K extends EventBusEventName>(
      event: K,
      payload: EventBusPayloadMap[K],
    ): void;
  };
}
