import type { IConnector } from "../domain/ports/IConnector";
import type { Conversation } from "../domain/entities/Conversation";
import { ChatEngine } from "./ChatEngine";
import conversationStore from "./stores/ConversationStore";
import messageStore from "./stores/MessageStore";

/**
 * MultiConversationEngine — orchestrates multiple conversations on a single connector.
 *
 * Uses a single ChatEngine internally to avoid multiple `onMessage` handler registrations.
 * Conversation switching is snapshot-based: messages are cached per conversation
 * in ConversationStore and restored into MessageStore when switching.
 *
 * Usage:
 *   const engine = new MultiConversationEngine(connector);
 *   await engine.init();            // connects + loads conversation list
 *   await engine.switchTo("conv-2");
 *   await engine.createNew("New Chat");
 */
export class MultiConversationEngine {
  private _connector: IConnector;
  private _chatEngine: ChatEngine;

  constructor(connector: IConnector) {
    this._connector = connector;
    this._chatEngine = new ChatEngine(connector);
  }

  /** Direct access to the underlying ChatEngine (send, sendFile, feedback, etc.). */
  get chatEngine(): ChatEngine {
    return this._chatEngine;
  }

  async init(): Promise<void> {
    // Register the conversation-update callback before connecting
    this._connector.onConversationUpdate?.((conv) => {
      conversationStore.getState().updateConversation(conv.id, conv);
    });

    await this._chatEngine.init();
    await this._loadConversations();
  }

  private async _loadConversations(): Promise<void> {
    if (!this._connector.listConversations) return;

    const convs = await this._connector.listConversations();
    conversationStore.getState().setConversations(convs);

    // Auto-activate the first open or pending conversation
    const first =
      convs.find((c) => c.status === "open" || c.status === "pending") ?? convs[0];
    if (first) {
      conversationStore.getState().setActive(first.id);
    }
  }

  /** Switch to a different conversation. Caches the current messages first. */
  async switchTo(conversationId: string): Promise<void> {
    const state = conversationStore.getState();
    const currentId = state.activeConversationId;

    if (currentId === conversationId) return;

    // Snapshot messages for the conversation we're leaving
    if (currentId !== null) {
      state.cacheMessages(currentId, [...messageStore.getState().messages]);
    }

    // Inform the connector (optional — lets it route subsequent messages correctly)
    await this._connector.switchConversation?.(conversationId);

    // Restore cached messages for the target conversation
    const cached = state.getCachedMessages(conversationId);
    messageStore.getState().restoreMessages(cached);

    state.setActive(conversationId);
    state.updateConversation(conversationId, { unreadCount: 0 });
  }

  /** Create a new conversation and switch to it. Returns null if the connector does not support it. */
  async createNew(
    title?: string,
    metadata?: Record<string, unknown>
  ): Promise<Conversation | null> {
    if (!this._connector.createConversation) return null;

    const conv = await this._connector.createConversation(title, metadata);
    conversationStore.getState().addConversation(conv);
    await this.switchTo(conv.id);
    return conv;
  }

  /** Close / archive a conversation. Switches away if it was the active one. */
  async close(conversationId: string): Promise<void> {
    if (!this._connector.closeConversation) return;

    await this._connector.closeConversation(conversationId);
    const state = conversationStore.getState();
    state.updateConversation(conversationId, { status: "closed" });

    if (state.activeConversationId === conversationId) {
      const next = state.conversations.find(
        (c) => c.id !== conversationId && c.status !== "closed"
      );
      if (next) await this.switchTo(next.id);
      else state.setActive(null);
    }
  }

  async destroy(): Promise<void> {
    await this._chatEngine.destroy();
    conversationStore.getState().setConversations([]);
    conversationStore.getState().setActive(null);
  }
}
