import { defineComponent, h } from "vue";
import { loadChativaUi } from "./internal/loadChativaUi";
import { useLoaded } from "./internal/useLoaded";
import { renderElement } from "./internal/renderElement";

/**
 * Vue 2.7 wrapper for `<chat-bot-button>` — the floating launcher that
 * toggles the shared `chatStore` open state. Default-slot content replaces
 * the built-in gradient circle with a fully custom launcher. Any listener
 * bound on the wrapper (e.g. `@click`) is attached to the element itself.
 */
export const ChatBotButton = defineComponent({
  name: "ChatBotButton",
  setup(_props, { slots, listeners }) {
    const ready = useLoaded(loadChativaUi);
    return () => {
      if (!ready.value) return h();
      return renderElement("chat-bot-button", { on: { ...listeners } }, slots.default?.());
    };
  },
});
