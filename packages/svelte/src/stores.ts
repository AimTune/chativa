import { readable, type Readable } from "svelte/store";
import {
  chatStore,
  messageStore,
  type ChatStoreState,
  type MessageStoreState,
  type StoredMessage,
} from "@chativa/core";
import { isBrowser } from "./internal/env.js";

/** The subset of a zustand vanilla store (`StoreApi`) that {@link toReadable} needs. */
export interface ZustandLikeStore<S> {
  getState(): S;
  subscribe(listener: (state: S, previousState: S) => void): () => void;
}

/**
 * Mirror a zustand vanilla store from `@chativa/core` (`chatStore`,
 * `messageStore`, `conversationStore`, …) as a Svelte readable store,
 * optionally narrowed by `select`.
 *
 * - The zustand subscription only exists while the readable has at least
 *   one subscriber (Svelte's `$store` auto-subscription handles this).
 * - Subscribers are only notified when the selected value actually changes
 *   (`Object.is`), so selecting a slice does not re-run on unrelated updates.
 * - On the server it yields the current snapshot once and never subscribes,
 *   so SSR renders the default state without leaking listeners.
 *
 * @example
 * ```ts
 * import { conversationStore } from "@chativa/core";
 * import { toReadable } from "@chativa/svelte";
 *
 * export const conversations = toReadable(conversationStore, (s) => s.conversations);
 * ```
 */
export function toReadable<S>(store: ZustandLikeStore<S>): Readable<S>;
export function toReadable<S, T>(store: ZustandLikeStore<S>, select: (state: S) => T): Readable<T>;
export function toReadable<S, T>(
  store: ZustandLikeStore<S>,
  select: (state: S) => T = (state) => state as unknown as T,
): Readable<T> {
  return readable<T>(select(store.getState()), (set) => {
    let current = select(store.getState());
    set(current);
    if (!isBrowser()) return;
    return store.subscribe((state) => {
      const next = select(state);
      if (Object.is(next, current)) return;
      current = next;
      set(next);
    });
  });
}

/**
 * The full `chatStore` state (open/fullscreen flags, connector status,
 * typing, unread count, theme, …) as a Svelte store — read it as `$chatState`.
 * Call actions on `chatStore` itself (e.g. `chatStore.getState().open()`).
 */
export const chatState: Readable<ChatStoreState> = toReadable(chatStore);

/** The full `messageStore` state (`messages`, `version`, actions) as a Svelte store. */
export const messageState: Readable<MessageStoreState> = toReadable(messageStore);

/** Just the rendered message list from `messageStore` — read it as `$messages`. */
export const messages: Readable<StoredMessage[]> = toReadable(messageStore, (s) => s.messages);
