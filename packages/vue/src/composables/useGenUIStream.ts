import {
  computed,
  shallowRef,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
} from "vue";
import {
  messageStore,
  type AIChunk,
  type GenUIStreamState,
  type StoredMessage,
} from "@chativa/core";
import { useStoreRef } from "../internal/storeRef";
import { useChativaEvent } from "./useChativaEvent";

/** One GenUI message from the message list, with its typed stream state. */
export interface GenUIStream {
  /** `messageStore` id of the `genui` message (pass it to `<GenUIMessage :message-id>`). */
  messageId: string;
  /** Chunks received so far (`ui` + `event`; text deltas render as separate text bubbles). */
  chunks: AIChunk[];
  /** True once the connector signalled the end of the stream. */
  streamingComplete: boolean;
  /** The underlying stored message, as `<ChatIva>` renders it. */
  message: StoredMessage;
}

/** Return value of {@link useGenUIStream}. */
export interface UseGenUIStreamReturn {
  /** Every GenUI message in the conversation, oldest first. */
  streams: ComputedRef<GenUIStream[]>;
  /** The stream for the `messageId` argument — or, without one, the newest GenUI stream. */
  stream: ComputedRef<GenUIStream | undefined>;
  /** `stream`'s chunks (empty when there is no stream). */
  chunks: ComputedRef<AIChunk[]>;
  /** Connector stream ids (`IConnector.onGenUIChunk`'s `streamId`) started and not yet completed since this composable was created. */
  activeStreamIds: ComputedRef<readonly string[]>;
  /** True while any reply stream (text or GenUI) is in flight, or any GenUI message is not yet complete. */
  isStreaming: ComputedRef<boolean>;
}

function toStream(message: StoredMessage): GenUIStream {
  const data = message.data as unknown as Partial<GenUIStreamState> | undefined;
  return {
    messageId: message.id,
    chunks: data?.chunks ?? [],
    streamingComplete: data?.streamingComplete === true,
    message,
  };
}

/**
 * Reactive view of Generative UI streaming.
 *
 * There is no separate "stream store" in `@chativa/core`: `ChatEngine` folds
 * every `onGenUIChunk` call into a `type: "genui"` message in `messageStore`
 * (whose `data` is a `GenUIStreamState`) and announces each stream's lifetime
 * on the `EventBus` (`genui_stream_started` / `genui_stream_completed`). This
 * composable combines both: the GenUI messages with typed chunk lists, plus
 * which connector streams are currently in flight.
 *
 * Call it from `setup()` (or inside an `effectScope()`); subscriptions are
 * released when that scope is disposed.
 *
 * @param messageId Optional GenUI message id (ref, getter or plain string) to
 *   focus `stream` / `chunks` on. Defaults to the newest GenUI message.
 *
 * @example
 * ```ts
 * const { stream, chunks, isStreaming } = useGenUIStream();
 * ```
 */
export function useGenUIStream(messageId?: MaybeRefOrGetter<string | undefined>): UseGenUIStreamReturn {
  const state = useStoreRef(messageStore);
  const active = shallowRef<readonly string[]>([]);

  useChativaEvent("genui_stream_started", ({ streamId }) => {
    if (!active.value.includes(streamId)) active.value = [...active.value, streamId];
  });
  useChativaEvent("genui_stream_completed", ({ streamId }) => {
    active.value = active.value.filter((id) => id !== streamId);
  });

  const streams = computed(() =>
    state.value.messages.filter((m) => m.type === "genui").map(toStream),
  );

  const stream = computed(() => {
    const id = toValue(messageId);
    const list = streams.value;
    if (id !== undefined) return list.find((s) => s.messageId === id);
    return list[list.length - 1];
  });

  return {
    streams,
    stream,
    chunks: computed(() => stream.value?.chunks ?? []),
    activeStreamIds: computed(() => active.value),
    isStreaming: computed(
      () => active.value.length > 0 || streams.value.some((s) => !s.streamingComplete),
    ),
  };
}
