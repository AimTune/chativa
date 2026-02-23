import { createStore } from "zustand/vanilla";
import type { IncomingMessage } from "../../domain/entities/Message";

export interface StoredMessage extends IncomingMessage {
  component?: typeof HTMLElement;
}

export interface MessageStoreState {
  messages: StoredMessage[];
  addMessage: (msg: StoredMessage) => void;
  removeById: (id: string) => void;
  updateById: (id: string, patch: Partial<StoredMessage>) => void;
  clear: () => void;
}

/** Track rendered IDs to prevent duplicates. */
const renderedIds = new Set<string>();

const store = createStore<MessageStoreState>((setState) => ({
  messages: [],

  addMessage: (msg) =>
    setState((state) => {
      if (renderedIds.has(msg.id)) return state; // deduplicate
      renderedIds.add(msg.id);
      return { messages: [...state.messages, msg] };
    }),

  removeById: (id) =>
    setState((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),

  updateById: (id, patch) =>
    setState((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...patch } : m
      ),
    })),

  clear: () => {
    renderedIds.clear();
    setState(() => ({ messages: [] }));
  },
}));

export default store;
