import { defineComponent, h, type PropType } from "vue";
import { loadChativaGenUi } from "./internal/loadChativaUi";
import { useLoaded } from "./internal/useLoaded";
import { renderElement, definedOnly, detailOf } from "./internal/renderElement";

/**
 * Vue 2.7 wrapper for `<genui-message>` — renders one streaming Generative
 * UI message outside `<ChatIva>`'s own message list.
 *
 * Every prop is forwarded as a DOM *property* (never an attribute), so the
 * `messageData` object and the boolean flags reach the element intact.
 * Unset props are not forwarded, leaving the element's own defaults.
 *
 * Events: `send-event` re-emits the `genui-send-event` CustomEvent detail
 * (`{ msgId, eventType, payload, sourceId? }`), `action` re-emits the
 * `chat-action` detail (the clicked value) from built-in GenUI components.
 *
 * Requires `@chativa/genui` — an optional peer dependency of this package.
 */
export const GenUIMessage = defineComponent({
  name: "GenUIMessage",
  props: {
    /** The streaming GenUI message payload (`GenUIStreamState`), as stored on the message. */
    messageData: { type: Object as PropType<Record<string, unknown>>, default: undefined },
    sender: { type: String as PropType<"user" | "bot">, default: undefined },
    messageId: { type: String, default: undefined },
    timestamp: { type: Number, default: undefined },
    hideAvatar: { type: Boolean, default: undefined },
    status: { type: String, default: undefined },
    /** Show developer diagnostics (e.g. the unknown-component fallback). */
    debug: { type: Boolean, default: undefined },
  },
  setup(props, { emit }) {
    const ready = useLoaded(loadChativaGenUi);
    return () => {
      if (!ready.value) return h();
      return renderElement("genui-message", {
        domProps: definedOnly({ ...props }),
        on: {
          "genui-send-event": (event: Event) => emit("send-event", detailOf(event)),
          "chat-action": (event: Event) => emit("action", detailOf(event)),
        },
      });
    };
  },
});
