import { defineComponent, shallowRef, type PropType } from "vue";
import type { GenUIEventOptions } from "@chativa/core";
import { loadChativaGenUi } from "./internal/loadChativaUi";
import { renderCustomElement, useLazyElement } from "./internal/element";

/** Props accepted by {@link GenUIMessage}. */
export interface GenUIMessageProps {
  /** The streaming GenUI message payload (`GenUIStreamState`), as delivered by `onGenUIChunk`/stored on the message. */
  messageData?: Record<string, unknown>;
  sender?: "user" | "bot";
  messageId?: string;
  timestamp?: number;
  hideAvatar?: boolean;
  status?: string;
  /** Show developer diagnostics (e.g. the unknown-component fallback). Off by default. */
  debug?: boolean;
}

/**
 * Detail of `<genui-message>`'s `genui-send-event` DOM event — a mounted GenUI
 * component called `sendEvent(eventType, payload, opts)`.
 */
export type GenUISendEventDetail = {
  msgId: string;
  eventType: string;
  payload: unknown;
  sourceId?: number;
} & GenUIEventOptions;

/**
 * Vue wrapper for `<genui-message>` — renders a streaming Generative UI
 * message (text + registered GenUI components) outside of `<ChatIva>`'s own
 * message list, e.g. to embed a single AI reply in a custom layout.
 *
 * Inside `<ChatIva>` the widget forwards component events to the connector
 * itself; a standalone `<GenUIMessage>` has no engine behind it, so the
 * element's kebab-case `genui-send-event` DOM event is re-emitted as the
 * camelCase `genuiSendEvent` Vue event for the host to handle.
 *
 * Requires `@chativa/genui` to be resolvable — it is an optional peer
 * dependency of `@chativa/vue` (already pulled in transitively by
 * `@chativa/ui` for `<ChatIva>`).
 */
export const GenUIMessage = defineComponent({
  name: "GenUIMessage",
  props: {
    messageData: { type: Object as PropType<Record<string, unknown>>, default: undefined },
    sender: { type: String as PropType<"user" | "bot">, default: undefined },
    messageId: { type: String, default: undefined },
    timestamp: { type: Number, default: undefined },
    hideAvatar: { type: Boolean, default: undefined },
    status: { type: String, default: undefined },
    debug: { type: Boolean, default: undefined },
  },
  emits: {
    /** A GenUI component inside the message called `sendEvent()`. */
    genuiSendEvent: (_detail: GenUISendEventDetail) => true,
  },
  setup(props, { emit, expose }) {
    const element = shallowRef<HTMLElement | null>(null);
    expose({ element });

    const ready = useLazyElement(loadChativaGenUi);

    return () =>
      ready.value
        ? renderCustomElement("genui-message", {
            ref: element,
            domProps: {
              messageData: props.messageData,
              sender: props.sender,
              messageId: props.messageId,
              timestamp: props.timestamp,
              hideAvatar: props.hideAvatar,
              status: props.status,
              debug: props.debug,
            },
            domEvents: {
              "genui-send-event": (event) =>
                emit("genuiSendEvent", (event as CustomEvent<GenUISendEventDetail>).detail),
            },
          })
        : null;
  },
});
