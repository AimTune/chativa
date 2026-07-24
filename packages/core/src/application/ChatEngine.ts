import type { IConnector, FeedbackType, SurveyPayload } from "../domain/ports/IConnector";
import type { OutgoingMessage } from "../domain/entities/Message";
import type { ToolCall } from "../domain/entities/ToolCall";
import type { AIChunk, AIChunkText, GenUIStreamState } from "../domain/entities/GenUI";
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
  /** Maps GenUI streamId → messageStore message id (the ui/event message). */
  private readonly _genUIStreams = new Map<string, string>();
  /** Reverse map: messageStore message id → streamId. Used to route component events. */
  private readonly _msgToStream = new Map<string, string>();
  /**
   * streamId → the open text-run bubble. Text deltas that share the run's chunk
   * `id` concatenate into it (one growing `default-text-message`); a new id opens a
   * fresh bubble. This is what renders token streaming as a normal message rather
   * than one bubble per token.
   */
  private readonly _textRuns = new Map<string, { msgId: string; runId: string | number }>();
  /**
   * streamId → the first message the stream created (text bubble or genui message).
   * The run's tool-call trace attaches here, wherever the stream started.
   */
  private readonly _streamHosts = new Map<string, string>();

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

      // A connector may deliver the user's own messages back through this
      // path (transcript replay, other-tab fan-out). Preserve their sender —
      // they must not render as bot bubbles, bump the unread badge, or absorb
      // the pending tool-call trace.
      const from: "bot" | "user" = transformed.from === "user" ? "user" : "bot";

      // Attach the tool-call trace collected for this reply, then reset the
      // buffer so the next turn starts clean. A connector that already put
      // `toolCalls` in the message data wins over the collected buffer.
      if (from === "bot") {
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
      }

      // Increment unread count when chat is closed
      if (from === "bot" && !chatStore.getState().isOpened) {
        chatStore.getState().incrementUnread();
      }

      const Component = MessageTypeRegistry.resolve(transformed.type);
      messageStore.getState().addMessage({ ...transformed, from, component: Component });
      EventBus.emit("message_received", transformed);
    });

    this.connector.onDisconnect?.((reason) => {
      this._setStatus("disconnected");
      // The run died with the socket — like the typing indicator, the live
      // tool-call strip must not stay stuck on "running". A resuming
      // connector replays the lifecycle frames after reconnect.
      chatStore.getState().clearToolCalls();
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
    const firstChunk = !this._streamHosts.has(streamId);

    // Text deltas render as a normal, growing bot bubble (default-text-message);
    // ui/event chunks drive the GenUI message. A mekik text run shares one chunk
    // id (PROTOCOL.md §4.1), so same-id deltas concatenate into one bubble and a
    // new id opens a fresh one — token streaming reads as a message, not as one
    // bubble per token.
    if (chunk.type === "text") {
      this._appendStreamedText(streamId, chunk);
    } else {
      this._appendGenUIComponent(streamId, chunk);
    }

    if (firstChunk) {
      EventBus.emit("genui_stream_started", { streamId });
      if (!chatStore.getState().isOpened) {
        chatStore.getState().incrementUnread();
      }
    }

    if (done) this._finishStream(streamId);
  }

  /** Grow the stream's open text bubble, or open a fresh one for a new text run. */
  private _appendStreamedText(streamId: string, chunk: AIChunkText): void {
    const run = this._textRuns.get(streamId);
    if (run && run.runId === chunk.id) {
      const current = messageStore.getState().messages.find((m) => m.id === run.msgId);
      const prev = (current?.data?.text as string | undefined) ?? "";
      messageStore.getState().updateById(run.msgId, {
        data: { ...current?.data, text: prev + chunk.content, streaming: true },
      });
      return;
    }
    // A new run id → a fresh bot text bubble the default component renders.
    const msgId = `mekik-text-${streamId}-${chunk.id}`;
    messageStore.getState().addMessage({
      id: msgId,
      type: "text",
      from: "bot",
      data: { text: chunk.content, streaming: true },
      timestamp: Date.now(),
      component: MessageTypeRegistry.resolve("text"),
    });
    this._textRuns.set(streamId, { msgId, runId: chunk.id });
    this._rememberHost(streamId, msgId);
  }

  /** Append a ui/event chunk to the stream's GenUI message, creating it on first use. */
  private _appendGenUIComponent(streamId: string, chunk: AIChunk): void {
    const existing = this._genUIStreams.get(streamId);
    if (!existing) {
      const msgId = `genui-${streamId}-${Date.now()}`;
      this._genUIStreams.set(streamId, msgId);
      this._msgToStream.set(msgId, streamId);
      const data: GenUIStreamState = { chunks: [chunk], streamingComplete: false };
      messageStore.getState().addMessage({
        id: msgId,
        type: "genui",
        from: "bot",
        data: data as unknown as Record<string, unknown>,
        timestamp: Date.now(),
        component: MessageTypeRegistry.resolve("genui"),
      });
      this._rememberHost(streamId, msgId);
      return;
    }
    // Subsequent ui/event chunk — append to the existing GenUI message.
    const current = messageStore.getState().messages.find((m) => m.id === existing);
    const prevState = (current?.data ?? { chunks: [], streamingComplete: false }) as unknown as GenUIStreamState;
    messageStore.getState().updateById(existing, {
      data: { ...current?.data, chunks: [...prevState.chunks, chunk], streamingComplete: false },
    });
  }

  /** Close every message the stream opened and drain its tool-call trace. */
  private _finishStream(streamId: string): void {
    const run = this._textRuns.get(streamId);
    if (run) {
      const current = messageStore.getState().messages.find((m) => m.id === run.msgId);
      messageStore.getState().updateById(run.msgId, { data: { ...current?.data, streaming: false } });
      this._textRuns.delete(streamId);
    }

    const genUIMsgId = this._genUIStreams.get(streamId);
    if (genUIMsgId) {
      const current = messageStore.getState().messages.find((m) => m.id === genUIMsgId);
      messageStore.getState().updateById(genUIMsgId, { data: { ...current?.data, streamingComplete: true } });
    }

    // Drain calls that settled after the host was created — otherwise they sit in
    // the live buffer after the run ends (stuck activity strip) and attach to the
    // next unrelated turn's reply.
    const host = this._streamHosts.get(streamId);
    if (host) this._drainToolCalls(host);

    this._genUIStreams.delete(streamId);
    if (genUIMsgId) this._msgToStream.delete(genUIMsgId);
    this._streamHosts.delete(streamId);
    EventBus.emit("genui_stream_completed", { streamId });
  }

  /**
   * Record the stream's first message as its trace host and attach whatever
   * tool-call trace has been collected for this reply, resetting the buffer. A
   * connector that already put `toolCalls` on the message wins.
   */
  private _rememberHost(streamId: string, msgId: string): void {
    if (this._streamHosts.has(streamId)) return;
    this._streamHosts.set(streamId, msgId);
    const toolCalls = chatStore.getState().activeToolCalls;
    if (toolCalls.length === 0) return;
    const current = messageStore.getState().messages.find((m) => m.id === msgId);
    if (current?.data?.toolCalls !== undefined) return;
    messageStore.getState().updateById(msgId, { data: { ...current?.data, toolCalls: [...toolCalls] } });
    chatStore.getState().clearToolCalls();
  }

  /** Merge any still-buffered tool calls into a message's attached trace. */
  private _drainToolCalls(msgId: string): void {
    const remaining = chatStore.getState().activeToolCalls;
    if (remaining.length === 0) return;
    const current = messageStore.getState().messages.find((m) => m.id === msgId);
    const existingTrace = current?.data?.toolCalls;
    const trace = Array.isArray(existingTrace) ? (existingTrace as ToolCall[]) : [];
    const merged = [
      ...trace.map((tc) => {
        const update = remaining.find((r) => r.id === tc.id);
        return update ? { ...tc, ...update } : tc;
      }),
      ...remaining.filter((r) => !trace.some((tc) => tc.id === r.id)),
    ];
    messageStore.getState().updateById(msgId, { data: { ...current?.data, toolCalls: merged } });
    chatStore.getState().clearToolCalls();
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
