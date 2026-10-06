import { computed, type ComputedRef } from "vue";
import { messageStore, type StoredMessage } from "@chativa/core";
import { useStoreRef } from "../internal/storeRef";

/** Return value of {@link useMessages}. */
export interface UseMessagesReturn {
  /** The current conversation's messages, oldest first. */
  messages: ComputedRef<StoredMessage[]>;
  /** Incremented on every store mutation — distinguishes in-place updates (e.g. a streaming bubble growing) from new messages. */
  version: ComputedRef<number>;
  /** The newest message, or `undefined` when the conversation is empty. */
  lastMessage: ComputedRef<StoredMessage | undefined>;
  /** Remove every message (what the built-in `/clear` command does). */
  clear: () => void;
  removeById: (id: string) => void;
  updateById: (id: string, patch: Partial<StoredMessage>) => void;
}

/**
 * Reactive view of the shared `messageStore` — the message list every
 * `<ChatIva>` renders, including streamed text and GenUI messages as they
 * grow. Call it from `setup()` (or inside an `effectScope()`); the store
 * subscription is released when that scope is disposed.
 *
 * Sending is not exposed here: outgoing messages go through the widget's
 * `ChatEngine`, which owns the connector — there is no store-level send.
 *
 * @example
 * ```ts
 * const { messages, lastMessage } = useMessages();
 * ```
 */
export function useMessages(): UseMessagesReturn {
  const state = useStoreRef(messageStore);
  const messages = computed(() => state.value.messages);

  return {
    messages,
    version: computed(() => state.value.version),
    lastMessage: computed(() => messages.value[messages.value.length - 1]),
    clear: () => messageStore.getState().clear(),
    removeById: (id) => messageStore.getState().removeById(id),
    updateById: (id, patch) => messageStore.getState().updateById(id, patch),
  };
}
