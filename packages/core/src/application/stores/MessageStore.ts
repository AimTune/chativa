import { createStore } from "zustand/vanilla";
import type { IncomingMessage, MessageStatus } from "../../domain/entities/Message";

export interface StoredMessage extends IncomingMessage {
  component?: typeof HTMLElement;
  /** Delivery/read status (user messages only). */
  status?: MessageStatus;
}

export interface MessageStoreState {
  messages: StoredMessage[];
  /** Incremented on every mutation — lets subscribers detect updates vs. new messages. */
  version: number;
  addMessage: (msg: StoredMessage) => void;
  prependMessages: (msgs: StoredMessage[]) => void;
  removeById: (id: string) => void;
  updateById: (id: string, patch: Partial<StoredMessage>) => void;
  clear: () => void;
}

/** Track rendered IDs to prevent duplicates. */
const renderedIds = new Set<string>();

const store = createStore<MessageStoreState>((setState) => ({
  messages: [],
  version: 0,

  addMessage: (msg) =>
    setState((state) => {
      if (renderedIds.has(msg.id)) return state; // deduplicate
      renderedIds.add(msg.id);
      return { messages: [...state.messages, msg], version: state.version + 1 };
    }),

  prependMessages: (msgs) =>
    setState((state) => {
      const fresh = msgs.filter((m) => !renderedIds.has(m.id));
      fresh.forEach((m) => renderedIds.add(m.id));
      return { messages: [...fresh, ...state.messages], version: state.version + 1 };
    }),

  removeById: (id) =>
    setState((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
      version: state.version + 1,
    })),

  updateById: (id, patch) =>
    setState((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...patch } : m
      ),
      version: state.version + 1,
    })),

  clear: () => {
    renderedIds.clear();
    setState((state) => ({ messages: [], version: state.version + 1 }));
  },
}));

export default store;
