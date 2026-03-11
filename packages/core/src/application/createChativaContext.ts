/**
 * Factory that builds a ChativaContext from the real Zustand stores.
 */
import type { ChativaContext } from "./ChativaContext";
import messageStore from "./stores/MessageStore";
import chatStore from "./stores/ChatStore";
import { EventBus } from "./EventBus";

export function createChativaContext(): ChativaContext {
  return {
    messages: {
      add: (msg) => messageStore.getState().addMessage(msg),
      update: (id, patch) => messageStore.getState().updateById(id, patch),
      remove: (id) => messageStore.getState().removeById(id),
      clear: () => messageStore.getState().clear(),
      getAll: () => messageStore.getState().messages,
    },
    chat: {
      open: () => chatStore.getState().open(),
      close: () => chatStore.getState().close(),
      toggle: () => chatStore.getState().toggle(),
      setTyping: (v) => chatStore.getState().setTyping(v),
      setFullscreen: (v) => chatStore.getState().setFullscreen(v),
      getStatus: () => chatStore.getState().connectorStatus,
      isOpened: () => chatStore.getState().isOpened,
    },
    theme: {
      get: () => chatStore.getState().getTheme(),
      set: (overrides) => chatStore.getState().setTheme(overrides),
    },
    events: EventBus,
  };
}
