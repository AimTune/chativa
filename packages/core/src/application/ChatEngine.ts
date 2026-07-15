import type { IConnector, FeedbackType, SurveyPayload } from "../domain/ports/IConnector";
import type { OutgoingMessage } from "../domain/entities/Message";
import type { ToolCall } from "../domain/entities/ToolCall";
import type { AIChunk, GenUIStreamState } from "../domain/entities/GenUI";
import { ExtensionRegistry } from "./registries/ExtensionRegistry";
import { MessageTypeRegistry } from "./registries/MessageTypeRegistry";
import messageStore from "./stores/MessageStore";
import chatStore from "./stores/ChatStore";
import type { ConnectorStatus } from "./stores/ChatStore";
import { EventBus } from "./EventBus";
import { createChativaContext } from "./createChativaContext";

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

  /** Set connector status in store and emit EventBus event. */
  private _setStatus(status: ConnectorStatus): void {
    chatStore.getState().setConnectorStatus(status);
    EventBus.emit("connector_status_changed", { status });
  }

  async init(): Promise<void> {
    this._destroyed = false;

    this.connector.onMessage((msg) => {
      chatStore.getState().setTyping(false);

      let transformed = ExtensionRegistry.runAfterReceive(msg);
      if (transformed === null) return; // extension blocked it

      // Attach the tool-call trace collected for this reply, then reset the
      // buffer so the next turn starts clean. A connector that already put
      // `toolCalls` in the message data wins over the collected buffer.
      const toolCalls = chatStore.getState().activeToolCalls;
      if (toolCalls.length > 0) {
        if (transformed.data?.toolCalls === undefined) {
          transformed = {
            ...transformed,
            data: { ...transformed.data, toolCalls: [...toolCalls] },
          };
        }
        chatStore.getState().clearToolCalls();
      }

      // Increment unread count when chat is closed
      if (!chatStore.getState().isOpened) {
        chatStore.getState().incrementUnread();
      }

      const Component = MessageTypeRegistry.resolve(transformed.type);
      messageStore.getState().addMessage({ ...transformed, from: "bot", component: Component });
      EventBus.emit("message_received", transformed);
    });

    this.connector.onDisconnect?.((reason) => {
      this._setStatus("disconnected");
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

    // Tool-call lifecycle events accumulate in the store until the reply
    // arrives; upsertToolCall also emits "tool_call_updated" on the EventBus.
    // A call whose trace is already attached to a delivered message (its
    // start and settle straddled a reply — e.g. a tool that pushed a GenUI
    // card mid-run) is patched in place instead; buffering it again would
    // leave the attached panel stuck on "running" and open a second trace.
    this.connector.onToolCall?.((toolCall) => {
      const inBuffer = chatStore
        .getState()
        .activeToolCalls.some((tc) => tc.id === toolCall.id);
      if (!inBuffer && this._patchAttachedToolCall(toolCall)) return;
      chatStore.getState().upsertToolCall(toolCall);
    });

    // Inject Chativa context so connector event handlers can interact with the UI
    this.connector.setContext?.(createChativaContext());

    this._setStatus("connecting");
    try {
      await this.connector.connect();
      this._setStatus("connected");
      // Load initial history if supported
      if (this.connector.loadHistory) {
        await this.loadHistory();
      }
    } catch (err) {
      this._setStatus("error");
      throw err;
    }
  }

  private _scheduleReconnect(attempt: number): void {
    if (this._destroyed || attempt > 3) {
      this._setStatus("error");
      chatStore.getState().setReconnectAttempt(0);
      return;
    }

    chatStore.getState().setReconnectAttempt(attempt);
    this._setStatus("connecting");

    const delay = 2000 * attempt; // 2s, 4s, 6s
    this._reconnectTimer = setTimeout(async () => {
      if (this._destroyed) return;
      try {
        await this.connector.connect();
        this._setStatus("connected");
        chatStore.getState().setReconnectAttempt(0);
      } catch {
        this._scheduleReconnect(attempt + 1);
      }
    }, delay);
  }

  async sendFeedback(messageId: string, feedback: FeedbackType): Promise<void> {
    await this.connector.sendFeedback?.(messageId, feedback);
  }

  async sendSurvey(payload: SurveyPayload): Promise<void> {
    await this.connector.sendSurvey?.(payload);
    EventBus.emit("survey_submitted", payload);
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
    EventBus.emit("message_sent", transformed);

    if (this.connector.addSentToHistory !== false) {
      // Only escalate from "sending" → "sent". A connector with
      // onMessageStatus may have already pushed "sent" or even "read"
      // (e.g. DirectLine echoes back faster than postActivity resolves);
      // we must never downgrade those.
      const current = messageStore
        .getState()
        .messages.find((m) => m.id === transformed.id);
      if (!current || current.status === "sending") {
        messageStore.getState().updateById(transformed.id, { status: "sent" });
      }
    }
  }

  async sendFile(file: File, metadata?: Record<string, unknown>): Promise<void> {
    if (this.connector.sendFile) {
      await this.connector.sendFile(file, metadata);
      EventBus.emit("file_uploaded", { name: file.name, size: file.size });
    }
  }

  async loadHistory(): Promise<void> {
    if (!this.connector.loadHistory) return;
    const { isLoadingHistory, historyCursor } = chatStore.getState();
    if (isLoadingHistory) return;

    chatStore.getState().setIsLoadingHistory(true);
    try {
      const result = await this.connector.loadHistory(historyCursor);
      const msgs = result.messages.map((m) => {
        const from = (m.from ?? "bot") as "bot" | "user";
        return {
          ...m,
          from,
          component: MessageTypeRegistry.resolve(m.type),
          // History is by definition past — user messages were already
          // delivered and seen. Default to "read" (double-tick) so they
          // don't render as a pending single-tick after a fresh page load.
          ...(from === "user" ? { status: "read" as const } : {}),
        };
      });
      messageStore.getState().prependMessages(msgs);
      chatStore.getState().setHasMoreHistory(result.hasMore);
      chatStore.getState().setHistoryCursor(result.cursor);
      EventBus.emit("history_loaded", { count: msgs.length });
    } finally {
      chatStore.getState().setIsLoadingHistory(false);
    }
  }

  /**
   * Merge a tool-call update into the newest message whose attached
   * `data.toolCalls` trace contains the same call. Returns false when no
   * message holds it (the normal case — the call is still in the live buffer).
   */
  private _patchAttachedToolCall(toolCall: ToolCall): boolean {
    const { messages, updateById } = messageStore.getState();
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const trace = msg.data?.toolCalls as ToolCall[] | undefined;
      if (!Array.isArray(trace) || !trace.some((tc) => tc.id === toolCall.id)) continue;
      updateById(msg.id, {
        data: {
          ...msg.data,
          toolCalls: trace.map((tc) =>
            tc.id === toolCall.id ? { ...tc, ...toolCall } : tc,
          ),
        },
      });
      EventBus.emit("tool_call_updated", toolCall);
      return true;
    }
    return false;
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
      const record = data as unknown as Record<string, unknown>;
      // A GenUI reply can follow tool calls just like a text reply — attach
      // the collected trace to the stream's message and reset the buffer.
      const toolCalls = chatStore.getState().activeToolCalls;
      if (toolCalls.length > 0) {
        record.toolCalls = [...toolCalls];
        chatStore.getState().clearToolCalls();
      }
      messageStore.getState().addMessage({
        id: msgId,
        type: "genui",
        from: "bot",
        data: record,
        timestamp: Date.now(),
        component: Component,
      });
      if (!chatStore.getState().isOpened) {
        chatStore.getState().incrementUnread();
      }
      EventBus.emit("genui_stream_started", { streamId });
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
      // Spread the previous data first so extra fields attached at creation
      // time (e.g. toolCalls) survive chunk updates.
      messageStore.getState().updateById(msgId, {
        data: { ...current?.data, ...(updated as unknown as Record<string, unknown>) },
      });
    }

    if (done) {
      EventBus.emit("genui_stream_completed", { streamId });
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
    this._setStatus("disconnected");
  }
}
