import { createStore } from "zustand/vanilla";
import type { Conversation } from "../../domain/entities/Conversation";
import type { StoredMessage } from "./MessageStore";

export interface ConversationStoreState {
  conversations: Conversation[];
  activeConversationId: string | null;
  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  updateConversation: (id: string, patch: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  setActive: (id: string | null) => void;
  /** Snapshot messages for a conversation (used before switching away). */
  cacheMessages: (id: string, msgs: StoredMessage[]) => void;
  /** Retrieve the cached message snapshot for a conversation. */
  getCachedMessages: (id: string) => StoredMessage[];
}

/** Message snapshot cache — lives outside Zustand to avoid unnecessary renders. */
const _messageCache = new Map<string, StoredMessage[]>();

const store = createStore<ConversationStoreState>((setState) => ({
  conversations: [],
  activeConversationId: null,

  setConversations: (convs) => setState({ conversations: convs }),

  addConversation: (conv) =>
    setState((s) => ({ conversations: [...s.conversations, conv] })),

  updateConversation: (id, patch) =>
    setState((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    })),

  removeConversation: (id) =>
    setState((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
    })),

  setActive: (id) => setState({ activeConversationId: id }),

  cacheMessages: (id, msgs) => {
    _messageCache.set(id, msgs);
  },

  getCachedMessages: (id) => _messageCache.get(id) ?? [],
}));

export default store;
