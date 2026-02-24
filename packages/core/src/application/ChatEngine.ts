import type { IConnector, FeedbackType } from "../domain/ports/IConnector";
import type { OutgoingMessage } from "../domain/entities/Message";
import type { AIChunk, GenUIStreamState } from "../domain/entities/GenUI";
import { ExtensionRegistry } from "./registries/ExtensionRegistry";
import { MessageTypeRegistry } from "./registries/MessageTypeRegistry";
import messageStore from "./stores/MessageStore";
import chatStore from "./stores/ChatStore";

export class ChatEngine {
  private connector: IConnector;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _destroyed = false;
  /** Maps GenUI streamId → messageStore message id. */
  private _genUIStreams = new Map<string, string>();
  /** Reverse map: messageStore message id → streamId. Used to route component events. */
  private _msgToStream = new Map<string, string>();

  constructor(connector: IConnector) {
    this.connector = connector;
  }

  async init(): Promise<void> {
    this._destroyed = false;

    this.connector.onMessage((msg) => {
      chatStore.getState().setTyping(false);

      const transformed = ExtensionRegistry.runAfterReceive(msg);
      if (transformed === null) return; // extension blocked it

      // Increment unread count when chat is closed
      if (!chatStore.getState().isOpened) {
        chatStore.getState().incrementUnread();
      }

      const Component = MessageTypeRegistry.resolve(transformed.type);
      messageStore.getState().addMessage({ ...transformed, from: "bot", component: Component });
    });

    this.connector.onDisconnect?.((reason) => {
      chatStore.getState().setConnectorStatus("disconnected");
      // Auto-reconnect unless destroyed or user-initiated disconnect
      if (!this._destroyed && reason !== "user") {
        this._scheduleReconnect(1);
      }
    });

    this.connector.onTyping?.((isTyping) => {
      chatStore.getState().setTyping(isTyping);
    });

    this.connector.onMessageStatus?.((messageId, status) => {
      messageStore.getState().updateById(messageId, { status });
    });

    this.connector.onGenUIChunk?.((streamId, chunk, done) => {
      this._handleGenUIChunk(streamId, chunk, done);
    });

    chatStore.getState().setConnectorStatus("connecting");
    try {
      await this.connector.connect();
      chatStore.getState().setConnectorStatus("connected");
      // Load initial history if supported
      if (this.connector.loadHistory) {
        await this.loadHistory();
      }
    } catch (err) {
      chatStore.getState().setConnectorStatus("error");
      throw err;
    }
  }

  private _scheduleReconnect(attempt: number): void {
    if (this._destroyed || attempt > 3) {
      chatStore.getState().setConnectorStatus("error");
      chatStore.getState().setReconnectAttempt(0);
      return;
    }

    chatStore.getState().setReconnectAttempt(attempt);
    chatStore.getState().setConnectorStatus("connecting");

    const delay = 2000 * attempt; // 2s, 4s, 6s
    this._reconnectTimer = setTimeout(async () => {
      if (this._destroyed) return;
      try {
        await this.connector.connect();
        chatStore.getState().setConnectorStatus("connected");
        chatStore.getState().setReconnectAttempt(0);
      } catch {
        this._scheduleReconnect(attempt + 1);
      }
    }, delay);
  }

  async sendFeedback(messageId: string, feedback: FeedbackType): Promise<void> {
    await this.connector.sendFeedback?.(messageId, feedback);
  }

  async send(message: OutgoingMessage): Promise<void> {
    const transformed = ExtensionRegistry.runBeforeSend(message);
    if (transformed === null) return; // extension blocked it

    if (this.connector.addSentToHistory !== false) {
      const Component = MessageTypeRegistry.resolve(transformed.type);
      messageStore.getState().addMessage({
        ...transformed,
        from: "user",
        component: Component,
        status: "sending",
      });
    }

    await this.connector.sendMessage(transformed);

    if (this.connector.addSentToHistory !== false) {
      messageStore.getState().updateById(transformed.id, { status: "sent" });
    }
  }

  async sendFile(file: File, metadata?: Record<string, unknown>): Promise<void> {
    await this.connector.sendFile?.(file, metadata);
  }

  async loadHistory(): Promise<void> {
    if (!this.connector.loadHistory) return;
    const { isLoadingHistory, historyCursor } = chatStore.getState();
    if (isLoadingHistory) return;

    chatStore.getState().setIsLoadingHistory(true);
    try {
      const result = await this.connector.loadHistory(historyCursor);
      const msgs = result.messages.map((m) => ({
        ...m,
        from: (m.from ?? "bot") as "bot" | "user",
        component: MessageTypeRegistry.resolve(m.type),
      }));
      messageStore.getState().prependMessages(msgs);
      chatStore.getState().setHasMoreHistory(result.hasMore);
      chatStore.getState().setHistoryCursor(result.cursor);
    } finally {
      chatStore.getState().setIsLoadingHistory(false);
    }
  }

  private _handleGenUIChunk(streamId: string, chunk: AIChunk, done: boolean): void {
    const Component = MessageTypeRegistry.resolve("genui");
    let msgId = this._genUIStreams.get(streamId);

    if (!msgId) {
      // First chunk for this stream — create the message in the store
      msgId = `genui-${streamId}-${Date.now()}`;
      this._genUIStreams.set(streamId, msgId);
      this._msgToStream.set(msgId, streamId);
      const data: GenUIStreamState = { chunks: [chunk], streamingComplete: done };
      messageStore.getState().addMessage({
        id: msgId,
        type: "genui",
        from: "bot",
        data: data as unknown as Record<string, unknown>,
        timestamp: Date.now(),
        component: Component,
      });
      if (!chatStore.getState().isOpened) {
        chatStore.getState().incrementUnread();
      }
    } else {
      // Subsequent chunk — append to existing message
      const current = messageStore.getState().messages.find((m) => m.id === msgId);
      const prevState = (current?.data ?? { chunks: [], streamingComplete: false }) as unknown as GenUIStreamState;
      const updated: GenUIStreamState = {
        chunks: chunk.type === "event" ? prevState.chunks : [...prevState.chunks, chunk],
        streamingComplete: done,
      };
      // Always deliver event chunks even if we skip storing them — the
      // GenUIMessage component reads them via a separate event-chunk array.
      // Store event chunks too so the component can replay them on re-render.
      if (chunk.type === "event") {
        updated.chunks = [...prevState.chunks, chunk];
      }
      messageStore.getState().updateById(msgId, {
        data: updated as unknown as Record<string, unknown>,
      });
    }

    if (done) {
      this._genUIStreams.delete(streamId);
      this._msgToStream.delete(msgId);
    }
  }

  /**
   * Called by ChatWidget when a GenUI component fires `sendEvent`.
   * Translates the message id back to the connector's stream id and forwards.
   */
  receiveComponentEvent(msgId: string, eventType: string, payload: unknown): void {
    const streamId = this._msgToStream.get(msgId);
    if (!streamId) return; // stream already complete or unknown
    this.connector.receiveComponentEvent?.(streamId, eventType, payload);
  }

  async destroy(): Promise<void> {
    this._destroyed = true;
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    chatStore.getState().setReconnectAttempt(0);
    await this.connector.disconnect();
    chatStore.getState().setConnectorStatus("disconnected");
  }
}
