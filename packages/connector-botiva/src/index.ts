import type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
  TypingHandler,
  SurveyPayload,
  ToolCall,
  ToolCallHandler,
  GenUIChunkHandler,
  AIChunk,
} from "@chativa/core";
import type { OutgoingMessage } from "@chativa/core";

export interface BotivaConnectorOptions {
  /** botiva WebSocket endpoint, e.g. "ws://localhost:8790/chat". */
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  /** Queue outgoing messages while the socket is down and flush on (re)connect. */
  queueOfflineMessages?: boolean;
  /** Stable user identity. Omit to let the server mint one (announced via `welcome`). */
  userId?: string;
  /** Conversation to resume. Omit to start a new one. */
  conversationId?: string;
  /** Persist identity + watermark in localStorage and resume across page reloads. */
  resumeConversation?: boolean;
}

/** Identity assigned/confirmed by the server's `welcome` frame. */
export interface BotivaIdentity {
  conversationId: string;
  userId: string;
  connectionId: string;
  watermark: number;
}

interface PersistedSession {
  userId?: string;
  conversationId?: string;
  watermark?: number;
}

/**
 * BotivaConnector — the single Chativa client connector for botiva servers
 * (Botiva Wire Protocol v1; botiva is the server-side sibling of Chativa).
 *
 * The wire protocol is identical over every botiva transport:
 *
 * - `{ type: "hello", ... }`      ← sent by us on open: userId / conversationId /
 *   watermark handshake. All fields optional; the server generates missing ids.
 * - `{ type: "welcome", data }`   → identity + current watermark; captured (and
 *   optionally persisted), never surfaced as a chat message.
 * - `{ type: "text", ... }`       → chat bubble; frames carrying `actions`
 *   (human-in-the-loop questions) surface as "quick-reply" messages so the
 *   chips render natively. `from: "user"` frames are the transcript replay /
 *   other-tab fan-out of the user's own messages.
 * - `{ type: "tool_call", data }` → ToolCall lifecycle frame (same `id`
 *   upserted as running → completed/error) → `onToolCall`.
 * - `{ type: "run", data: { status } }` → run lifecycle; mapped to the typing
 *   indicator (`started` → typing on, `finished` → typing off).
 * - `{ type: "genui", streamId, chunk, done }` → Generative UI chunk; mounts a
 *   GenUIRegistry component inline via `onGenUIChunk`.
 * - `{ type: "genui_event", streamId, eventType, payload }` ← sent by us when
 *   a mounted GenUI component fires an event (form submit, card action, …).
 *
 * Persistent frames carry `seq`; we track the highest one as our watermark and
 * hand it back on reconnect, so the server replays only what we missed —
 * DirectLine-style resume, multi-tab and multi-device included.
 */
export class BotivaConnector implements IConnector {
  readonly name = "botiva";
  readonly addSentToHistory = true;

  private ws: WebSocket | null = null;
  private options: Required<
    Omit<BotivaConnectorOptions, "userId" | "conversationId">
  > &
    Pick<BotivaConnectorOptions, "userId" | "conversationId">;

  private messageHandler: MessageHandler | null = null;
  private connectHandler: ConnectHandler | null = null;
  private disconnectHandler: DisconnectHandler | null = null;
  private typingHandler: TypingHandler | null = null;
  private toolCallHandler: ToolCallHandler | null = null;
  private genUIChunkHandler: GenUIChunkHandler | null = null;

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set by disconnect(); suppresses auto-reconnect without mutating options. */
  private closedByUser = false;
  private queue: Array<{ payload: string; resolve: () => void }> = [];
  private watermark = 0;
  private _identity: BotivaIdentity | null = null;

  constructor(options: BotivaConnectorOptions) {
    this.options = {
      protocols: [],
      reconnect: true,
      reconnectDelay: 2000,
      maxReconnectAttempts: 5,
      queueOfflineMessages: true,
      resumeConversation: false,
      ...options,
    };
    if (this.options.resumeConversation) {
      const saved = this.loadSession();
      this.options.userId ??= saved?.userId;
      this.options.conversationId ??= saved?.conversationId;
      this.watermark = saved?.watermark ?? 0;
    }
  }

  /** Identity from the last `welcome` frame (null before the first connect). */
  get identity(): BotivaIdentity | null {
    return this._identity;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Re-entrant safe: ChatEngine's auto-reconnect and our own onclose timer
      // can both call connect() after the same drop — tear down whichever
      // socket exists (detached first so its close event can't re-schedule)
      // so only one live socket ever routes frames.
      if (this.reconnectTimer !== null) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.detachSocket();
      this.closedByUser = false;

      const ws = new WebSocket(this.options.url, this.options.protocols);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        // botiva/1 handshake — all fields optional, server fills the gaps.
        ws.send(
          JSON.stringify({
            type: "hello",
            userId: this.options.userId,
            conversationId: this.options.conversationId,
            watermark: this.watermark,
          }),
        );
        this.flushQueue();
        this.connectHandler?.();
        resolve();
      };

      ws.onerror = (event) => {
        reject(new Error(`BotivaConnector WebSocket error: ${JSON.stringify(event)}`));
      };

      ws.onmessage = (event: MessageEvent) => {
        this.routeFrame(event.data as string);
      };

      ws.onclose = (event) => {
        // The run may have died with the socket — don't leave typing stuck on.
        this.typingHandler?.(false);
        this.disconnectHandler?.(event.reason);
        if (
          !this.closedByUser &&
          this.options.reconnect &&
          this.reconnectAttempts < this.options.maxReconnectAttempts
        ) {
          this.reconnectAttempts++;
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.closedByUser) return;
            this.connect().catch(() => {});
          }, this.options.reconnectDelay);
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    this.closedByUser = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.detachSocket();
  }

  /** Detach all handlers and close the current socket (if any) without side effects. */
  private detachSocket(): void {
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = null;
    ws.onerror = null;
    ws.onmessage = null;
    ws.onclose = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    await this.sendOrQueue(JSON.stringify(message));
  }

  /** Send the survey as a JSON frame with discriminator `{ type: "survey", ... }`. */
  async sendSurvey(payload: SurveyPayload): Promise<void> {
    await this.sendOrQueue(JSON.stringify({ type: "survey", ...payload }));
  }

  onMessage(callback: MessageHandler): void {
    this.messageHandler = callback;
  }

  onConnect(callback: ConnectHandler): void {
    this.connectHandler = callback;
  }

  onDisconnect(callback: DisconnectHandler): void {
    this.disconnectHandler = callback;
  }

  onTyping(callback: TypingHandler): void {
    this.typingHandler = callback;
  }

  onToolCall(callback: ToolCallHandler): void {
    this.toolCallHandler = callback;
  }

  onGenUIChunk(callback: GenUIChunkHandler): void {
    this.genUIChunkHandler = callback;
  }

  /**
   * Forward a GenUI component event (form submit, card action, …) to the
   * server as `{ type: "genui_event", streamId, eventType, payload }` —
   * the outbound counterpart of the inbound `genui` frame.
   */
  receiveComponentEvent(streamId: string, eventType: string, payload: unknown): void {
    void this.sendOrQueue(
      JSON.stringify({ type: "genui_event", streamId, eventType, payload }),
    );
  }

  // ── internals ────────────────────────────────────────────────────────

  private routeFrame(raw: string): void {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      this.messageHandler?.({
        id: `botiva-${Date.now()}`,
        type: "text",
        data: { text: raw },
        timestamp: Date.now(),
      });
      return;
    }

    // Watermark: every persistent frame carries `seq` — remember the highest
    // so reconnects replay only what we missed.
    if (typeof data.seq === "number" && data.seq > this.watermark) {
      this.watermark = data.seq;
      if (this.options.resumeConversation) this.saveSession();
    }

    // Handshake response: identity + current watermark. Not a chat message.
    // (Like tool_call, the payload may also be flattened onto the frame.)
    if (data?.type === "welcome") {
      const d = (data.data ?? data) as Partial<BotivaIdentity>;
      const prevConversationId = this.options.conversationId;
      this._identity = {
        conversationId: String(d.conversationId ?? this.options.conversationId ?? ""),
        userId: String(d.userId ?? this.options.userId ?? ""),
        connectionId: String(d.connectionId ?? ""),
        watermark: Number(d.watermark ?? this.watermark),
      };
      // Adopt server-minted ids so the next reconnect resumes this session —
      // but never clobber a configured id with an empty value from a partial
      // welcome payload.
      if (this._identity.userId) this.options.userId = this._identity.userId;
      if (this._identity.conversationId) {
        this.options.conversationId = this._identity.conversationId;
      }
      // A different conversation than the one we tried to resume (e.g. the old
      // one expired) means our watermark belongs to the old transcript —
      // restart the new conversation's replay window from zero.
      if (
        this._identity.conversationId &&
        this._identity.conversationId !== prevConversationId
      ) {
        this.watermark = 0;
      }
      if (this.options.resumeConversation) this.saveSession();
      return;
    }

    // Tool-call lifecycle frame: { type: "tool_call", data: {...ToolCall} }
    // (the payload may also be flattened onto the frame itself).
    if (data?.type === "tool_call") {
      const payload = ((data.data ?? data) as unknown) as ToolCall;
      if (payload.id && payload.name && payload.status) {
        this.toolCallHandler?.(payload);
      }
      return;
    }

    // Generative UI frame: { type: "genui", streamId, chunk, done }.
    if (data?.type === "genui") {
      const streamId = String(data.streamId ?? "");
      const chunk = data.chunk as AIChunk | undefined;
      if (streamId && chunk && typeof chunk === "object") {
        this.genUIChunkHandler?.(streamId, chunk, data.done === true);
      }
      return;
    }

    // Run lifecycle frame: { type: "run", data: { status } } → typing indicator.
    if (data?.type === "run") {
      const status = (data.data as Record<string, unknown> | undefined)?.status;
      this.typingHandler?.(status === "started");
      return;
    }

    // A bot text frame carrying `actions` (HITL interrupt question,
    // suggestions) renders through the native quick-reply component: chips
    // that send the tapped value back as the user's answer — which is how
    // an interrupted run is resumed.
    if (
      data?.type === "text" &&
      data.from !== "user" &&
      Array.isArray(data.actions) &&
      data.actions.length > 0
    ) {
      this.typingHandler?.(false);
      const inner = (data.data ?? {}) as Record<string, unknown>;
      this.messageHandler?.({
        id: String(data.id ?? `botiva-${Date.now()}`),
        type: "quick-reply",
        data: { ...inner, actions: data.actions, keepActions: true },
        timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now(),
      });
      return;
    }

    // A bot message ends any visible "working" state.
    this.typingHandler?.(false);
    this.messageHandler?.(data as never);
  }

  /**
   * Send now, or queue until the next (re)connect. A queued payload's promise
   * resolves only when it is actually flushed onto the wire, so ChatEngine
   * keeps the bubble on "sending" instead of stamping "sent" for a message
   * the server never received.
   */
  private sendOrQueue(payload: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      return Promise.resolve();
    }
    if (this.options.queueOfflineMessages) {
      return new Promise((resolve) => this.queue.push({ payload, resolve }));
    }
    return Promise.reject(new Error("BotivaConnector: not connected."));
  }

  private flushQueue(): void {
    while (this.queue.length && this.ws?.readyState === WebSocket.OPEN) {
      const entry = this.queue.shift()!;
      this.ws.send(entry.payload);
      entry.resolve();
    }
  }

  private storageKey(): string {
    return `chativa:botiva:${this.options.url}`;
  }

  private loadSession(): PersistedSession | null {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(this.storageKey());
      return raw ? (JSON.parse(raw) as PersistedSession) : null;
    } catch {
      return null;
    }
  }

  private saveSession(): void {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(
        this.storageKey(),
        JSON.stringify({
          userId: this.options.userId,
          conversationId: this.options.conversationId,
          watermark: this.watermark,
        } satisfies PersistedSession),
      );
    } catch {
      /* storage unavailable — resume silently disabled */
    }
  }
}

/** @deprecated Renamed — use {@link BotivaConnector}. */
export const LineConnector = BotivaConnector;
/** @deprecated Renamed — use {@link BotivaConnectorOptions}. */
export type LineConnectorOptions = BotivaConnectorOptions;
