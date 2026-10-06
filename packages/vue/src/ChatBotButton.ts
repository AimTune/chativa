import { defineComponent, shallowRef } from "vue";
import { loadChativaUi } from "./internal/loadChativaUi";
import { renderCustomElement, useLazyElement } from "./internal/element";

/**
 * Vue wrapper for `<chat-bot-button>` — the floating launcher button.
 * `<ChatIva>` is only the chat panel; it has no launcher of its own, so a
 * normal popup setup renders `<ChatBotButton>` alongside it to toggle the
 * shared `chatStore`'s open state. Default-slot content replaces the built-in
 * gradient-circle icon with a fully custom launcher.
 *
 * SSR-safe: renders a comment placeholder until `@chativa/ui` has loaded on
 * the client.
 */
export const ChatBotButton = defineComponent({
  name: "ChatBotButton",
  setup(_props, { slots, expose }) {
    const element = shallowRef<HTMLElement | null>(null);
    expose({ element });

    const ready = useLazyElement(loadChativaUi);

    return () =>
      ready.value
        ? renderCustomElement("chat-bot-button", { ref: element }, slots.default?.())
        : null;
  },
});
