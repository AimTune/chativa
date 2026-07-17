import type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
  TypingHandler,
  SurveyPayload,
  ToolCallHandler,
  GenUIChunkHandler,
} from "@chativa/core";
import type { OutgoingMessage } from "@chativa/core";
// Value import — deliberately from the `frames` subpath, not the package root:
// the root would inline all of core into this connector's standalone bundle.
import { parseChatFrame, createGenUIEventFrame } from "@chativa/core/frames";
import type {
  BotivaAuthContext,
  BotivaAuthDecision,
  BotivaAuthError,
  BotivaAuthProvider,
  BotivaCredential,
} from "./auth";
import { TokenAuth } from "./auth";

export type {
  BotivaAuthContext,
  BotivaAuthDecision,
  BotivaAuthError,
  BotivaAuthProvider,
  BotivaCredential,
  BotivaTokenTransport,
  CookieAuthOptions,
  TokenAuthOptions,
} from "./auth";
export { CookieAuth, TokenAuth } from "./auth";

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
  /**
   * How this client authenticates, for servers that authenticate (PROTOCOL.md
   * §2.1) — the client-side mirror of the server's `Authenticator` port. Pass an
   * adapter: {@link CookieAuth} for a cookie session, {@link TokenAuth} for an
   * API key or a short-lived JWT, or your own {@link BotivaAuthProvider}.
   * Omit entirely for servers that don't authenticate.
   *
   * Takes precedence over {@link BotivaConnectorOptions.token}.
   */
  auth?: BotivaAuthProvider;
  /**
   * Shorthand for `auth: new TokenAuth({ token, maxRetries: 0 })` — a credential
   * sent in the `hello` handshake, with no retry after a rejection.
   *
   * @deprecated Prefer `auth`, which also covers cookie sessions, the `query`
   * transport, and refresh-and-retry. This shorthand stays for compatibility.
   */
  token?: string | ((ctx: BotivaAuthContext) => string | Promise<string>);
  /**
   * Called when the server rejects the connection (an `error` frame + close,
   * WebSocket code 4401). Fires regardless of which `auth` adapter is used, and
   * before any provider-driven retry. Auto-reconnect stays suppressed unless the
   * provider asks to retry, so this is where an app redirects to login.
   */
  onAuthError?: (error: BotivaAuthError) => void;
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
 * - `{ type: "error", data: { code, message } }` → auth rejection (§2.1),
 *   followed by a close (code 4401); surfaced via `onAuthError`, reconnect off.
 *
 * Authenticated servers (PROTOCOL.md §2.1): pass an `auth` provider — the
 * client-side mirror of botiva's `Authenticator` port. `CookieAuth` for a cookie
 * session, `TokenAuth` for an API key or short-lived JWT, or your own adapter.
 * The provider is consulted before every socket, so it can mint a fresh
 * credential per attempt and decide whether a rejection is worth retrying.
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
    Omit<BotivaConnectorOptions, "userId" | "conversationId" | "auth" | "token" | "onAuthError">
  > &
    Pick<
      BotivaConnectorOptions,
      "userId" | "conversationId" | "auth" | "token" | "onAuthError"
    >;

  /** The `auth` adapter, or one desugared from the legacy `token` option. */
  private readonly authProvider: BotivaAuthProvider | undefined;

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
  /** Set when the server rejects auth; suppresses reconnect and is cleared on the next connect(). */
  private _authError: BotivaAuthError | null = null;
  /** Auth attempts for the current connection; reset once the server welcomes us. */
  private authAttempt = 0;
  /** The context handed to the provider for the in-flight attempt (replayed to onReject). */
  private authContext: BotivaAuthContext | null = null;
  /**
   * Bumped by every connect()/disconnect(). An `authenticate()` call that
   * resolves after its generation is stale belongs to a superseded attempt and
   * must not open a socket.
   */
  private generation = 0;

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
    // `token` is the legacy spelling of the same idea: hello-frame transport,
    // and no retry — re-sending a rejected credential the app never refreshed
    // would just be refused again, which is what it did before `auth` existed.
    this.authProvider =
      options.auth ??
      (options.token !== undefined
        ? new TokenAuth({ token: options.token, maxRetries: 0 })
        : undefined);
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

  /** The last auth rejection (null unless the server refused this connection). */
  get authError(): BotivaAuthError | null {
    return this._authError;
  }

  async connect(): Promise<void> {
    this.authAttempt = 0;
    return this.connectWithAuth(0, null);
  }

  /**
   * One connection attempt at a given auth attempt number. Split from connect()
   * so a provider-driven retry can re-enter with an incremented `attempt` and
   * the rejection that caused it, which is what lets `authenticate()` mint a
   * different credential than the one that was just refused.
   */
  private async connectWithAuth(
    attempt: number,
    previousError: BotivaAuthError | null,
  ): Promise<void> {
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
    this._authError = null;
    const generation = ++this.generation;

    // The credential is resolved before the socket exists because a `query`
    // transport has to be in the URL the handshake opens with — too late once
    // onopen fires. A provider that throws fails connect() with its error
    // rather than degrading to an anonymous attempt, which would surface a
    // credential outage as a misleading "unauthorized" from the server.
    let credential: BotivaCredential = {};
    if (this.authProvider) {
      const ctx: BotivaAuthContext = { url: this.options.url, attempt, previousError };
      this.authContext = ctx;
      credential = await this.authProvider.authenticate(ctx);
    }
    // disconnect() or a newer connect() landed while we were resolving — that
    // attempt owns the socket now, so this one must not open a second one.
    if (this.closedByUser || generation !== this.generation) return;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.buildUrl(credential.query), this.options.protocols);
      this.ws = ws;

      ws.onopen = () => {
        this.sendHello(ws, credential.token, resolve);
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
        // An auth rejection (error frame seen, or close code 4401) must not
        // auto-reconnect: the same credential would just be refused again. A
        // retry only happens if the auth provider asks for one, because only it
        // can produce a credential that would fare any better.
        const authRejected =
          this._authError !== null ||
          (event as { code?: number }).code === 4401;
        if (
          !this.closedByUser &&
          !authRejected &&
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
    // Strands any in-flight authenticate(): its generation is now stale, so it
    // cannot open a socket after we've been told to shut down.
    this.generation++;
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
      JSON.stringify(createGenUIEventFrame(streamId, eventType, payload)),
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

    // Auth rejection (PROTOCOL.md §2.1): { type: "error", data: { code, message } }
    // followed by a close (code 4401). Surface it and stop reconnecting.
    if (data?.type === "error") {
      const d = (data.data ?? {}) as Record<string, unknown>;
      const error: BotivaAuthError = {
        code: String(d.code ?? "error"),
        message: String(d.message ?? ""),
      };
      this._authError = error;
      this.typingHandler?.(false);
      this.options.onAuthError?.(error);
      this.disconnectHandler?.(error.message);
      void this.handleAuthRejection(error);
      return;
    }

    // Handshake response: identity + current watermark. Not a chat message.
    // (Like tool_call, the payload may also be flattened onto the frame.)
    if (data?.type === "welcome") {
      // A welcome means the server accepted this credential — the only real
      // proof auth succeeded, since a rejection arrives after the socket opens.
      this.authAttempt = 0;
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

    // Run lifecycle frame: { type: "run", data: { status } } → typing indicator.
    // botiva-specific: the shared vocabulary has no `run` frame.
    if (data?.type === "run") {
      const status = (data.data as Record<string, unknown> | undefined)?.status;
      this.typingHandler?.(status === "started");
      return;
    }

    // The frames botiva shares with every other Chativa connector — tool calls,
    // GenUI chunks and the HITL chips — are routed by the one parser in core so
    // the rules can't drift apart between transports.
    const frame = parseChatFrame(data, { idPrefix: "botiva" });
    switch (frame.kind) {
      case "tool_call":
        this.toolCallHandler?.(frame.toolCall);
        return;
      case "genui":
        this.genUIChunkHandler?.(frame.streamId, frame.chunk, frame.done);
        return;
      case "typing":
        this.typingHandler?.(frame.isTyping);
        return;
      case "quick_reply":
        // The question itself ends the visible "working" state.
        this.typingHandler?.(false);
        this.messageHandler?.(frame.message);
        return;
      case "other":
        break;
    }

    // A malformed `tool_call`/`genui` frame is dropped rather than falling
    // through to the message handler: rendering half a trace as a chat bubble
    // would be worse than ignoring a frame the server got wrong.
    if (data?.type === "tool_call" || data?.type === "genui") return;

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

  /**
   * Build the socket URL, merging in any query credential. Kept separate from
   * `options.url`, which stays credential-free — it is the localStorage key and
   * the value handed to the provider.
   */
  private buildUrl(query?: Record<string, string>): string {
    if (!query || Object.keys(query).length === 0) return this.options.url;
    const url = new URL(this.options.url);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  /**
   * Ask the provider what to do about a rejection. Only a provider can know
   * whether a fresh credential is obtainable, so the retry decision is its call
   * — the connector just carries it out.
   */
  private async handleAuthRejection(error: BotivaAuthError): Promise<void> {
    const provider = this.authProvider;
    if (!provider?.onReject) return;

    const ctx = this.authContext ?? {
      url: this.options.url,
      attempt: this.authAttempt,
      previousError: null,
    };

    let decision: BotivaAuthDecision;
    try {
      decision = await provider.onReject(error, ctx);
    } catch {
      decision = "fail"; // a provider that can't decide doesn't get to retry
    }
    if (decision !== "retry" || this.closedByUser) return;

    this.authAttempt = ctx.attempt + 1;
    await this.connectWithAuth(this.authAttempt, error).catch(() => {
      /* the retry failed too — onAuthError already told the app */
    });
  }

  /** Send the botiva/1 hello handshake once the socket is open, then resolve connect(). */
  private sendHello(ws: WebSocket, token: string | undefined, resolve: () => void): void {
    this.reconnectAttempts = 0;
    // botiva/1 handshake — all fields optional, server fills the gaps.
    // `token` is only present when the server authenticates (§2.1).
    ws.send(
      JSON.stringify({
        type: "hello",
        userId: this.options.userId,
        conversationId: this.options.conversationId,
        watermark: this.watermark,
        ...(token ? { token } : {}),
      }),
    );
    this.flushQueue();
    this.connectHandler?.();
    resolve();
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
