import type {
  ChativaContext,
  Conversation,
  ConversationHandler,
  ConversationStatus,
  FeedbackType,
  HistoryResult,
  IncomingMessage,
  MessageStatus,
  MessageStatusHandler,
  OutgoingMessage,
} from "@chativa/core";
// Value import from the `frames` subpath, not the package root: the root would
// inline all of core into this connector's standalone bundle.
import { parseChatFrame } from "@chativa/core/frames";
import { MekikConnector, TokenAuth } from "@chativa/connector-mekik";
import type {
  MekikAuthContext,
  MekikAuthDecision,
  MekikAuthError,
  MekikAuthProvider,
  MekikConnectorOptions,
  MekikCredential,
} from "@chativa/connector-mekik";

// Everything an app needs comes from this one package: the auth adapters and
// the base class are connector-mekik's, re-exported unchanged.
export { CookieAuth, TokenAuth, MekikConnector } from "@chativa/connector-mekik";
export type {
  CookieAuthOptions,
  MekikAuthContext,
  MekikAuthDecision,
  MekikAuthError,
  MekikAuthProvider,
  MekikCredential,
  MekikIdentity,
  MekikTokenTransport,
  TokenAuthOptions,
} from "@chativa/connector-mekik";

export interface ConvergerConnectorOptions extends MekikConnectorOptions {
  /**
   * Converger client API base, e.g. "https://chat.example.com/api/v1/converger".
   * Default: derived from `url` — same host, `ws:` → `http:`, `wss:` → `https:`,
   * path `/api/v1/converger`.
   */
  apiUrl?: string;
  /**
   * The `auth` provider yields a **channel-scoped** token (agent consoles,
   * `tokens/generate` with `{"scope": "channel"}`). REST calls (the conversation
   * list, create, close) use it as is; each conversation's socket uses a
   * conversation-bound token exchanged for it with `GET /conversations/:id`, so
   * the agent's own turns are `from: "user"` on its side. No socket is opened
   * until a conversation is chosen (`switchConversation`).
   */
  channelScoped?: boolean;
  /**
   * Frames per `loadHistory` page (`GET .../activities?direction=backward`).
   * The newest page is fetched over REST and the socket replays only what is
   * newer. `0` turns REST history off: the socket replays the whole transcript.
   * Default 50.
   */
  historyPageSize?: number;
  /**
   * How long `sendMessage` waits for the server's `ack` before the message is
   * marked `failed`, in ms. `0` waits forever. Default 15000.
   */
  ackTimeout?: number;
  /**
   * How many times a send refused with a retryable error (`rate_limited`,
   * `too_many_in_flight`, `unavailable`, …) is sent again with the same
   * `clientId`. Default 2.
   */
  maxSendRetries?: number;
  /**
   * Send `read` receipts for the other side's messages while the widget is open,
   * so their sender sees the double tick turn to read. Default true.
   */
  readReceipts?: boolean;
  /** The reaction text `sendFeedback` posts. Default `{ like: "👍", dislike: "👎" }`. */
  feedbackReactions?: { like?: string; dislike?: string };
}

/** A non-2xx answer from the Converger client API. */
export class ConvergerApiError extends Error {
  /** HTTP status (0 for an `error` frame on the socket). */
  readonly status: number;
  /** Converger's stable error code, e.g. `conversation_closed`. */
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ConvergerApiError";
    this.status = status;
    this.code = code;
  }
}

interface PendingSend {
  payload: string;
  conversationId: string | undefined;
  /** The socket the payload last went out on (null while still queued). */
  socket: WebSocket | null;
  retries: number;
  timer: ReturnType<typeof setTimeout> | null;
  resolve: () => void;
  reject: (err: Error) => void;
}

interface Page {
  result: HistoryResult;
  newestSeq: number;
}

/** Converger's `clientId` syntax (Protocol v1 section 7). */
const CLIENT_ID = /^[A-Za-z0-9._:~-]{1,128}$/;
/** Error codes a send may be retried for with the same clientId (section 12.2). */
const RETRYABLE = new Set(["rate_limited", "too_many_in_flight", "unavailable", "internal", "busy"]);
/** Persistent frames that are not chat bubbles — left out of history pages. */
const NOT_A_BUBBLE = new Set([
  "tool_call", "skill", "genui", "interrupt", "interrupt_resolved", "event",
  "conversationUpdate", "typing", "run", "genui_components", "skills",
]);
/** Converger `deliveryStatus.status` → chativa `MessageStatus`. */
const DELIVERY: Record<string, MessageStatus> = {
  queued: "sent",
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};
const RANK: Record<MessageStatus, number> = { failed: -1, sending: 0, sent: 1, delivered: 2, read: 3 };
/** Bound tokens are re-exchanged when they have less than this left. */
const TOKEN_MARGIN_MS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function deriveApiUrl(wsUrl: string): string {
  const url = new URL(wsUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "/api/v1/converger";
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** The token a credential carries, whichever transport it rides on. */
function tokenOf(credential: MekikCredential): string | undefined {
  if (credential.token) return credential.token;
  const query = credential.query ?? {};
  return query.token ?? Object.values(query)[0];
}

/** The chativa message type for an attachment's content type. */
function attachmentType(contentType: string): "image" | "video" | "file" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "file";
}

/**
 * ConvergerConnector — chativa's client for a [Converger](https://github.com/AimTune/converger)
 * channel hub.
 *
 * Converger Protocol v1 is a superset of mekik/1, so this is a thin extension
 * of {@link MekikConnector}: the same socket, auth providers, reconnect, offline
 * queue, watermark resume, tool calls, GenUI and interrupts. It asks for the
 * full protocol (subprotocol `converger.v1`, `hello.protocol: "converger/1"`)
 * and adds the hub extras over the frames and REST API only Converger has:
 *
 * - every turn carries a `clientId`; `sendMessage` resolves on the server's
 *   `ack` and the message is marked `failed` on an `error` naming it;
 * - `deliveryStatus` frames → `onMessageStatus` (`sent` / `delivered` / `read` / `failed`);
 * - `sendFile` → multipart upload; `loadHistory(cursor)` → backward paging;
 *   `sendFeedback` → a `messageReaction` activity;
 * - `listConversations` / `createConversation` / `switchConversation` /
 *   `closeConversation` / `onConversationUpdate` for agent-panel mode — one
 *   socket for the active conversation at a time.
 */
export class ConvergerConnector extends MekikConnector {
  override readonly name: string = "converger";

  readonly #apiUrl: string;
  readonly #channelScoped: boolean;
  readonly #pageSize: number;
  readonly #ackTimeout: number;
  readonly #maxSendRetries: number;
  readonly #readReceipts: boolean;
  readonly #reactions: Record<FeedbackType, string>;
  /** The app's auth provider (the base class gets a wrapper around it). */
  readonly #auth: MekikAuthProvider | undefined;

  #baseToken: string | null = null;
  readonly #boundTokens = new Map<string, { token: string; expiresAt: number }>();

  readonly #pending = new Map<string, PendingSend>();
  #lastEncoded: { clientId: string; payload: string } | null = null;
  /** From `welcome.data.capabilities.acks`; a server without acks resolves sends at once. */
  #acks = true;

  #statusHandler: MessageStatusHandler | null = null;
  readonly #statuses = new Map<string, MessageStatus>();
  readonly #activityToMessage = new Map<string, string>();
  readonly #messageToActivity = new Map<string, string>();
  /** seq → message id of this side's own messages, for `read {upToSeq}` receipts. */
  readonly #ownSeqs = new Map<number, string>();

  #conversationHandler: ConversationHandler | null = null;
  readonly #conversations = new Map<string, Conversation>();
  readonly #lastSeqs = new Map<string, number>();
  /** Resume point per conversation, kept across `switchConversation`. */
  readonly #watermarks = new Map<string, number>();

  #firstPage: { conversationId: string; page: Page } | null = null;
  /** The watermark the current socket replays from; older frames come from REST. */
  #historyFloor = 0;
  /** `welcome.data.watermark`: frames above it are live, not replayed. */
  #liveFrom = 0;

  /** Ids of this side's attachment messages already handed to chativa. */
  readonly #shownUploads = new Set<string>();

  #pingTimer: ReturnType<typeof setInterval> | null = null;
  #context: ChativaContext | null = null;
  #readTimer: ReturnType<typeof setTimeout> | null = null;
  #highestOtherSeq = 0;
  #readSent = 0;

  constructor(options: ConvergerConnectorOptions) {
    const {
      apiUrl,
      channelScoped,
      historyPageSize,
      ackTimeout,
      maxSendRetries,
      readReceipts,
      feedbackReactions,
      auth,
      token,
      ...rest
    } = options;
    // The base class consults its provider before every socket. Wrapping the
    // app's provider is how this connector learns the token for REST calls and
    // swaps in a conversation-bound token where one is needed.
    const self: { connector: ConvergerConnector | null } = { connector: null };
    const wrapped: MekikAuthProvider = {
      name: "converger",
      authenticate: (ctx) => self.connector!.#socketCredential(ctx),
      onReject: (error, ctx) => self.connector!.#onReject(error, ctx),
    };
    super({ ...rest, protocols: rest.protocols ?? ["converger.v1"], auth: wrapped });
    self.connector = this;

    this.#auth =
      auth ?? (token !== undefined ? new TokenAuth({ token, maxRetries: 0 }) : undefined);
    this.#apiUrl = (apiUrl ?? deriveApiUrl(options.url)).replace(/\/+$/, "");
    this.#channelScoped = channelScoped === true;
    this.#pageSize = Math.max(0, historyPageSize ?? 50);
    this.#ackTimeout = Math.max(0, ackTimeout ?? 15_000);
    this.#maxSendRetries = Math.max(0, maxSendRetries ?? 2);
    this.#readReceipts = readReceipts !== false;
    this.#reactions = {
      like: feedbackReactions?.like ?? "👍",
      dislike: feedbackReactions?.dislike ?? "👎",
    };
  }

  /** The Converger client API base this connector talks to. */
  get apiUrl(): string {
    return this.#apiUrl;
  }

  setContext(ctx: ChativaContext): void {
    this.#context = ctx;
    // Opening the widget is when the other side's messages get seen.
    ctx.events.on("widget_opened", () => this.#scheduleRead(0));
  }

  // ── lifecycle ────────────────────────────────────────────────────────

  override async connect(): Promise<void> {
    if (this.#channelScoped && !this.options.conversationId) {
      // An agent console has nothing to open until a conversation is chosen.
      this.connectHandler?.();
      return;
    }
    await this.#prefetchNewestPage();
    this.#historyFloor = this.watermark;
    return super.connect();
  }

  override async disconnect(): Promise<void> {
    this.#stopTimers();
    return super.disconnect();
  }

  // ── extension hooks ──────────────────────────────────────────────────

  protected override helloExtras(): Record<string, unknown> {
    return { protocol: "converger/1" };
  }

  protected override encodeTurn(message: OutgoingMessage): unknown {
    // chativa stamps every message with an id of the clientId syntax; one that
    // isn't (a custom id) is sent without, and is persisted without an ack.
    if (typeof message.id !== "string" || !CLIENT_ID.test(message.id)) return message;
    const frame = { ...message, clientId: message.id };
    this.#lastEncoded = { clientId: message.id, payload: JSON.stringify(frame) };
    return frame;
  }

  protected override interceptFrame(frame: Record<string, unknown>): boolean {
    switch (frame.type) {
      case "welcome":
        this.#onWelcome(frame);
        return false; // identity, interrupts and capabilities stay the base's job
      case "ack":
        this.#onAck(frame);
        return true;
      case "deliveryStatus":
        this.#onDeliveryStatus(frame);
        return true;
      case "conversationUpdate":
        this.#onConversationFrame(frame);
        return true;
      case "error":
        return this.#onError(frame);
      // Converger-only frames that are not chat bubbles. `event` carries
      // reactions, edits and deletes of other activities.
      case "heartbeat":
      case "presence":
      case "tokenRefreshed":
      case "replayTruncated":
      case "event":
        return true;
    }
    this.#normalize(frame);
    if (this.#isLive(frame)) this.#onLiveMessage(frame);
    const attachment = this.#attachmentMessage(frame);
    if (attachment) {
      // An upload of ours arrives twice: in the REST answer and on the socket.
      if (this.#shownUploads.has(attachment.id)) return true;
      if (frame.from === "user") this.#shownUploads.add(attachment.id);
      this.messageHandler?.(attachment);
      this.#resolveAttachment(attachment);
      return true;
    }
    return false;
  }

  // ── sending ──────────────────────────────────────────────────────────

  /**
   * Send a turn and resolve once Converger acknowledges it (`ack`). The message
   * is marked `failed` — and the promise rejects — when the server refuses it
   * with a non-retryable error, or no ack arrives within `ackTimeout`.
   */
  override async sendMessage(message: OutgoingMessage): Promise<void> {
    this.#lastEncoded = null;
    const sent = super.sendMessage(message);
    // encodeTurn ran synchronously inside super.sendMessage — unless the
    // message became a `resume` answer, which Converger does not ack.
    const encoded = this.#lastEncoded as { clientId: string; payload: string } | null;
    this.#lastEncoded = null;
    if (!encoded) return sent;

    const { clientId, payload } = encoded;
    const acked = new Promise<void>((resolve, reject) => {
      this.#pending.set(clientId, {
        payload,
        conversationId: this.options.conversationId,
        socket: null,
        retries: 0,
        timer: null,
        resolve,
        reject,
      });
    });
    try {
      await sent; // resolves when the frame is on the wire (queued until then)
    } catch (err) {
      this.#pending.delete(clientId);
      throw err;
    }
    const entry = this.#pending.get(clientId);
    if (entry) {
      entry.socket = this.ws;
      if (this.#acks) this.#arm(clientId);
      else this.#settle(clientId);
    }
    return acked;
  }

  /**
   * Upload a file (`POST /conversations/:id/upload`, multipart). The server
   * answers with the attachment message as the socket delivers it; it is shown
   * at once (with a local preview URL) and the socket copy is de-duplicated by id.
   */
  async sendFile(file: File, metadata?: Record<string, unknown>): Promise<void> {
    const conversationId = this.#requireConversation();
    const { caption, ...channelData } = metadata ?? {};
    const activity: Record<string, unknown> = {};
    if (typeof caption === "string" && caption) activity.text = caption;
    if (Object.keys(channelData).length > 0) activity.channelData = channelData;

    const form = new FormData();
    form.append("file", file, file.name);
    form.append("activity", JSON.stringify(activity));
    const body = await this.#request(`/conversations/${encodeURIComponent(conversationId)}/upload`, {
      method: "POST",
      body: form,
    });
    const frame = isRecord(body) && isRecord(body.frame) ? body.frame : null;
    if (!frame) return;
    this.#normalize(frame);
    const message = this.#attachmentMessage(frame) ?? (frame as unknown as IncomingMessage);
    // The socket copy may have won the race; the bubble is already there.
    if (this.#shownUploads.has(message.id)) return;
    this.#shownUploads.add(message.id);
    // The uploader has the bytes: preview them without a second, authorized download.
    const preview = typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
    if (preview && message.type !== "text") {
      message.data = { ...message.data, ...(message.type === "file" ? { url: preview } : { src: preview }) };
    }
    this.messageHandler?.(message);
  }

  /**
   * Like or dislike a message: posts a `messageReaction` activity replying to
   * it, with the reaction text from `feedbackReactions`.
   */
  async sendFeedback(messageId: string, feedback: FeedbackType): Promise<void> {
    const conversationId = this.#requireConversation();
    await this.#request(`/conversations/${encodeURIComponent(conversationId)}/activities`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "messageReaction",
        replyToId: this.#messageToActivity.get(messageId) ?? messageId,
        text: this.#reactions[feedback],
      }),
    });
  }

  // ── receipts ─────────────────────────────────────────────────────────

  onMessageStatus(callback: MessageStatusHandler): void {
    this.#statusHandler = callback;
  }

  // ── history ──────────────────────────────────────────────────────────

  /**
   * One page of older messages, oldest first. Without a cursor: the page just
   * below what the socket replays. `cursor` is a Converger `seq`
   * (`GET .../activities?direction=backward&before=<cursor>&format=frames`).
   */
  async loadHistory(cursor?: string): Promise<HistoryResult> {
    const conversationId = this.options.conversationId;
    if (!conversationId || this.#pageSize === 0) return { messages: [], hasMore: false };
    if (cursor === undefined && this.#firstPage?.conversationId === conversationId) {
      const { page } = this.#firstPage;
      this.#firstPage = null;
      return page.result;
    }
    const before = cursor ?? (this.#historyFloor > 0 ? String(this.#historyFloor + 1) : undefined);
    return (await this.#fetchPage(conversationId, before)).result;
  }

  // ── multi-conversation (agent panel) ─────────────────────────────────

  /**
   * The channel's conversations, most recently active first
   * (`GET /conversations`, channel-scoped token).
   */
  async listConversations(): Promise<Conversation[]> {
    const body = await this.#request("/conversations?limit=100");
    const rows = isRecord(body) && Array.isArray(body.conversations) ? body.conversations : [];
    const list: Conversation[] = [];
    for (const row of rows) {
      if (!isRecord(row) || typeof row.id !== "string") continue;
      const conversation: Conversation = {
        id: row.id,
        title:
          (typeof row.title === "string" && row.title) ||
          (typeof row.contact === "string" && row.contact) ||
          row.id,
        status: row.status === "closed" ? "closed" : "open",
        ...(typeof row.contact === "string" ? { contact: row.contact } : {}),
        ...(typeof row.lastMessage === "string" ? { lastMessage: row.lastMessage } : {}),
        ...(typeof row.lastMessageAt === "number" ? { lastMessageAt: row.lastMessageAt } : {}),
        ...(isRecord(row.metadata) ? { metadata: row.metadata } : {}),
      };
      if (typeof row.lastSeq === "number") this.#lastSeqs.set(row.id, row.lastSeq);
      this.#conversations.set(row.id, conversation);
      list.push(conversation);
    }
    return list;
  }

  /** Start a conversation (`POST /conversations`); the title is stored as `metadata.title`. */
  async createConversation(title?: string, metadata?: Record<string, unknown>): Promise<Conversation> {
    const body = await this.#request("/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(title ? { title } : {}),
    });
    const record = isRecord(body) ? body : {};
    const id = typeof record.conversationId === "string" ? record.conversationId : "";
    if (!id) throw new ConvergerApiError(500, "invalid_response", "ConvergerConnector: no conversationId in the response.");
    this.#rememberBoundToken(id, record);
    const conversation: Conversation = {
      id,
      title: title || id,
      status: "open",
      lastMessageAt: Date.now(),
      ...(metadata ? { metadata } : {}),
    };
    this.#conversations.set(id, conversation);
    this.#lastSeqs.set(id, 0);
    return conversation;
  }

  /**
   * Make `conversationId` the active one: the socket reconnects for it (with a
   * conversation-bound token in `channelScoped` mode), resuming from where this
   * connector left it or, the first time, from just below its newest page.
   */
  async switchConversation(conversationId: string): Promise<void> {
    const current = this.options.conversationId;
    if (current === conversationId && this.ws?.readyState === WebSocket.OPEN) return;
    if (current) this.#watermarks.set(current, this.watermark);
    for (const [clientId, pending] of this.#pending) {
      if (pending.conversationId !== conversationId) {
        this.#fail(clientId, new Error("ConvergerConnector: switched conversation before the send was acknowledged."));
      }
    }
    this.options.conversationId = conversationId;
    this.#firstPage = null;
    this.#highestOtherSeq = 0;
    this.#readSent = 0;
    const saved = this.#watermarks.get(conversationId);
    const lastSeq = this.#lastSeqs.get(conversationId);
    this.watermark =
      saved ?? (lastSeq !== undefined && this.#pageSize > 0 ? Math.max(0, lastSeq - this.#pageSize) : 0);
    this.#historyFloor = this.watermark;
    await super.connect();
  }

  /** Close a conversation (`POST /conversations/:id/close`). */
  async closeConversation(conversationId: string): Promise<void> {
    await this.#request(`/conversations/${encodeURIComponent(conversationId)}/close`, { method: "POST" });
  }

  /**
   * Conversation metadata changes: `conversationUpdate` frames (closed,
   * reopened) and the last-message preview of the active conversation.
   */
  onConversationUpdate(callback: ConversationHandler): void {
    this.#conversationHandler = callback;
  }

  // ── frame handlers ───────────────────────────────────────────────────

  #onWelcome(frame: Record<string, unknown>): void {
    const data = isRecord(frame.data) ? frame.data : frame;
    const conversationId = typeof data.conversationId === "string" && data.conversationId
      ? data.conversationId
      : this.options.conversationId;
    if (conversationId !== this.options.conversationId) {
      // The server started a different conversation: no older history to page.
      this.#historyFloor = 0;
      this.#firstPage = null;
    }
    this.#liveFrom = typeof data.watermark === "number" ? data.watermark : 0;
    const caps = isRecord(data.capabilities) ? data.capabilities : {};
    this.#acks = caps.acks === true;
    const limits = isRecord(data.limits) ? data.limits : {};
    const idle =
      typeof limits.idleTimeoutMs === "number" && limits.idleTimeoutMs > 0 ? limits.idleTimeoutMs : 60_000;
    this.#startPing(idle / 2);

    // Turns that went out on an earlier socket and were never acked are sent
    // again with their original clientId; the server de-duplicates them.
    for (const [clientId, pending] of this.#pending) {
      if (!this.#acks) {
        this.#settle(clientId);
        continue;
      }
      if (pending.conversationId !== undefined && pending.conversationId !== conversationId) continue;
      if (pending.socket !== null && pending.socket !== this.ws) {
        this.ws?.send(pending.payload);
        pending.socket = this.ws;
        this.#arm(clientId);
      }
    }
  }

  #onAck(frame: Record<string, unknown>): void {
    const clientId = typeof frame.clientId === "string" ? frame.clientId : "";
    if (!clientId) return;
    if (typeof frame.id === "string") this.#link(frame.id, clientId);
    if (typeof frame.seq === "number") this.#ownSeqs.set(frame.seq, clientId);
    this.#emitStatus(clientId, "sent");
    this.#settle(clientId);
  }

  #onDeliveryStatus(frame: Record<string, unknown>): void {
    const data = isRecord(frame.data) ? frame.data : {};
    const status = typeof data.status === "string" ? DELIVERY[data.status] : undefined;
    if (!status) return;
    if (typeof data.upToSeq === "number") {
      // A read watermark: everything of ours up to that seq was read.
      for (const [seq, id] of this.#ownSeqs) {
        if (seq <= data.upToSeq) this.#emitStatus(id, status);
      }
      return;
    }
    if (typeof data.activityId === "string") {
      this.#emitStatus(this.#activityToMessage.get(data.activityId) ?? data.activityId, status);
    }
  }

  #onConversationFrame(frame: Record<string, unknown>): void {
    const conversationId = this.options.conversationId;
    if (!conversationId) return;
    const data = isRecord(frame.data) ? frame.data : {};
    let status: ConversationStatus | undefined;
    if (data.status === "closed" || data.event === "conversation_closed" || data.event === "conversation_ended") {
      status = "closed";
    } else if (data.status === "active" || data.event === "conversation_reopened") {
      status = "open";
    }
    if (status) this.#emitConversation(conversationId, { status });
  }

  /** Returns true when the error was about one of our sends (and is handled here). */
  #onError(frame: Record<string, unknown>): boolean {
    const data = isRecord(frame.data) ? frame.data : {};
    const code = typeof data.code === "string" ? data.code : "error";
    if (code === "token_expired" || code === "token_revoked") {
      // The full protocol keeps Converger's code; the base class only knows
      // mekik/1's `unauthorized`, which is what makes it ask the auth provider
      // for a fresh credential and reconnect with the same watermark.
      data.code = "unauthorized";
      return false;
    }
    const clientId = typeof data.clientId === "string" ? data.clientId : "";
    if (!clientId) return false;
    const pending = this.#pending.get(clientId);
    if (!pending) return true;
    const retryable = data.retryable === true || RETRYABLE.has(code);
    if (retryable && pending.retries < this.#maxSendRetries) {
      pending.retries++;
      if (pending.timer !== null) clearTimeout(pending.timer);
      const wait = typeof data.retryAfterMs === "number" ? data.retryAfterMs : 1000;
      pending.timer = setTimeout(() => this.#resend(clientId), wait);
      return true;
    }
    const message = typeof data.message === "string" && data.message ? data.message : code;
    this.#fail(clientId, new ConvergerApiError(0, code, `ConvergerConnector: send refused (${code}): ${message}`));
    return true;
  }

  // ── send bookkeeping ─────────────────────────────────────────────────

  #arm(clientId: string): void {
    const pending = this.#pending.get(clientId);
    if (!pending || this.#ackTimeout === 0) return;
    if (pending.timer !== null) clearTimeout(pending.timer);
    pending.timer = setTimeout(
      () => this.#fail(clientId, new Error(`ConvergerConnector: no ack for ${clientId} within ${this.#ackTimeout} ms.`)),
      this.#ackTimeout,
    );
  }

  #resend(clientId: string): void {
    const pending = this.#pending.get(clientId);
    if (!pending) return;
    pending.timer = null;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(pending.payload);
      pending.socket = this.ws;
      this.#arm(clientId);
    } else {
      // Down right now: the next welcome sends it again.
      pending.socket = pending.socket ?? this.ws;
    }
  }

  #settle(clientId: string): void {
    const pending = this.#pending.get(clientId);
    if (!pending) return;
    if (pending.timer !== null) clearTimeout(pending.timer);
    this.#pending.delete(clientId);
    pending.resolve();
  }

  #fail(clientId: string, err: Error): void {
    const pending = this.#pending.get(clientId);
    if (!pending) return;
    if (pending.timer !== null) clearTimeout(pending.timer);
    this.#pending.delete(clientId);
    this.#emitStatus(clientId, "failed");
    pending.reject(err);
  }

  /** Statuses only move forward; `failed` never overrides delivered or read. */
  #emitStatus(id: string, status: MessageStatus): void {
    const current = this.#statuses.get(id);
    if (current !== undefined) {
      if (status === "failed" ? RANK[current] >= RANK.delivered : RANK[current] >= RANK[status]) return;
    }
    this.#statuses.set(id, status);
    this.#statusHandler?.(id, status);
  }

  #link(activityId: string, messageId: string): void {
    this.#activityToMessage.set(activityId, messageId);
    this.#messageToActivity.set(messageId, activityId);
  }

  // ── message frames ───────────────────────────────────────────────────

  /**
   * Give this side's own messages the id chativa stamped on them (their
   * `clientId`), so a replayed or uploaded copy de-duplicates against the
   * bubble already on screen, and remember their seq for read receipts.
   */
  #normalize(frame: Record<string, unknown>): void {
    if (frame.from !== "user") return;
    if (typeof frame.clientId === "string" && frame.clientId && typeof frame.id === "string") {
      this.#link(frame.id, frame.clientId);
      frame.id = frame.clientId;
    }
    if (typeof frame.seq === "number" && typeof frame.id === "string") {
      this.#ownSeqs.set(frame.seq, frame.id);
    }
  }

  #isLive(frame: Record<string, unknown>): boolean {
    return typeof frame.seq === "number" && frame.seq > this.#liveFrom;
  }

  #onLiveMessage(frame: Record<string, unknown>): void {
    const conversationId = this.options.conversationId;
    const seq = frame.seq as number;
    if (conversationId) {
      this.#lastSeqs.set(conversationId, seq);
      const data = isRecord(frame.data) ? frame.data : {};
      if (typeof data.text === "string" && data.text && !NOT_A_BUBBLE.has(String(frame.type))) {
        this.#emitConversation(conversationId, {
          lastMessage: data.text,
          lastMessageAt: typeof frame.timestamp === "number" ? frame.timestamp : Date.now(),
        });
      }
    }
    if (frame.from !== "user" && seq > this.#highestOtherSeq) {
      this.#highestOtherSeq = seq;
      this.#scheduleRead(500);
    }
  }

  /**
   * A message frame carrying `data.attachments` (an upload, or a file from
   * another channel) as chativa's `image` / `video` / `file` message.
   */
  #attachmentMessage(frame: Record<string, unknown>): IncomingMessage | null {
    if (frame.type !== "text" || !isRecord(frame.data) || !Array.isArray(frame.data.attachments)) return null;
    const attachment = frame.data.attachments.find(isRecord);
    if (!attachment || typeof attachment.contentUrl !== "string") return null;
    const contentType = typeof attachment.contentType === "string" ? attachment.contentType : "";
    const type = attachmentType(contentType);
    const caption = typeof frame.data.text === "string" && frame.data.text ? frame.data.text : undefined;
    const name = typeof attachment.name === "string" ? attachment.name : undefined;
    const data: Record<string, unknown> =
      type === "file"
        ? {
            url: attachment.contentUrl,
            name: name ?? "file",
            mimeType: contentType,
            ...(typeof attachment.size === "number" ? { size: attachment.size } : {}),
          }
        : { src: attachment.contentUrl, ...(type === "image" && name ? { alt: name } : {}) };
    if (caption) data.caption = caption;
    return {
      id: typeof frame.id === "string" ? frame.id : `converger-${Date.now()}`,
      type,
      ...(frame.from === "user" || frame.from === "bot" ? { from: frame.from } : {}),
      data,
      ...(typeof frame.timestamp === "number" ? { timestamp: frame.timestamp } : {}),
    };
  }

  /**
   * Converger serves attachments only with an `Authorization` header, which an
   * `<img src>` cannot send. With a chativa context, fetch the file with the
   * token and point the message at a local object URL instead.
   */
  #resolveAttachment(message: IncomingMessage): void {
    const ctx = this.#context;
    const key = message.type === "file" ? "url" : "src";
    const url = message.data[key];
    if (!ctx || typeof url !== "string" || !url.startsWith(`${this.#apiUrl}/attachments/`)) return;
    if (typeof URL.createObjectURL !== "function") return;
    void this.#fetchBlob(url)
      .then((blob) => ctx.messages.update(message.id, { data: { ...message.data, [key]: URL.createObjectURL(blob) } }))
      .catch(() => {
        /* the bubble keeps the original URL */
      });
  }

  async #fetchBlob(url: string): Promise<Blob> {
    const res = await fetch(url, { headers: { authorization: `Bearer ${await this.#restToken()}` } });
    if (!res.ok) throw new ConvergerApiError(res.status, "attachment_unavailable", `attachment ${res.status}`);
    return res.blob();
  }

  /** A history frame as a chat message, or null for frames that are not bubbles. */
  #historyMessage(frame: Record<string, unknown>): IncomingMessage | null {
    this.#normalize(frame);
    if (typeof frame.type !== "string" || NOT_A_BUBBLE.has(frame.type)) return null;
    const attachment = this.#attachmentMessage(frame);
    if (attachment) return attachment;
    const parsed = parseChatFrame(frame, { idPrefix: "converger" });
    if (parsed.kind === "quick_reply") return parsed.message;
    if (parsed.kind !== "other" || !isRecord(frame.data)) return null;
    return frame as unknown as IncomingMessage;
  }

  // ── read receipts ────────────────────────────────────────────────────

  #scheduleRead(delay: number): void {
    if (!this.#readReceipts || this.#readTimer !== null) return;
    this.#readTimer = setTimeout(() => {
      this.#readTimer = null;
      this.#sendRead();
    }, delay);
  }

  #sendRead(): void {
    if (this.#highestOtherSeq <= this.#readSent) return;
    if (this.#context && !this.#context.chat.isOpened()) return; // unseen while closed
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "read", watermark: this.#highestOtherSeq }));
    this.#readSent = this.#highestOtherSeq;
  }

  // ── conversations ────────────────────────────────────────────────────

  #emitConversation(id: string, patch: Partial<Conversation>): void {
    const known = this.#conversations.get(id) ?? { id, title: id, status: "open" as const };
    const next = { ...known, ...patch };
    this.#conversations.set(id, next);
    this.#conversationHandler?.(next);
  }

  #requireConversation(): string {
    const id = this.identity?.conversationId || this.options.conversationId;
    if (!id) throw new Error("ConvergerConnector: no conversation yet — connect (or switch to a conversation) first.");
    return id;
  }

  // ── history pages ────────────────────────────────────────────────────

  /**
   * Fetch the newest page before the socket opens, so the socket replays only
   * what is newer and the page is what the first `loadHistory()` returns. Only
   * for a known conversation this connector has no resume point for; a failure
   * falls back to a full replay over the socket.
   */
  async #prefetchNewestPage(): Promise<void> {
    const conversationId = this.options.conversationId;
    if (!conversationId || this.watermark > 0 || this.#pageSize === 0) return;
    if (this.#firstPage?.conversationId === conversationId) return;
    try {
      const page = await this.#fetchPage(conversationId, undefined);
      this.#firstPage = { conversationId, page };
      this.watermark = page.newestSeq;
    } catch {
      /* the socket replays the whole transcript instead */
    }
  }

  async #fetchPage(conversationId: string, before: string | undefined): Promise<Page> {
    const query = new URLSearchParams({
      direction: "backward",
      format: "frames",
      limit: String(this.#pageSize),
    });
    if (before !== undefined) query.set("before", before);
    const userId = this.identity?.userId || this.options.userId;
    if (userId) query.set("userId", userId);
    const body = await this.#request(
      `/conversations/${encodeURIComponent(conversationId)}/activities?${query.toString()}`,
    );
    const record = isRecord(body) ? body : {};
    const frames = Array.isArray(record.frames) ? record.frames.filter(isRecord) : [];
    let newestSeq = 0;
    const messages: IncomingMessage[] = [];
    for (const frame of frames) {
      if (typeof frame.seq === "number" && frame.seq > newestSeq) newestSeq = frame.seq;
      const message = this.#historyMessage(frame);
      if (message) {
        messages.push(message);
        this.#resolveAttachment(message);
      }
    }
    const cursor = record.cursor;
    return {
      newestSeq,
      result: {
        messages,
        hasMore: record.has_more === true,
        ...(typeof cursor === "string" || typeof cursor === "number" ? { cursor: String(cursor) } : {}),
      },
    };
  }

  // ── auth + REST ──────────────────────────────────────────────────────

  /** The credential for a socket: the app's, or a conversation-bound token. */
  async #socketCredential(ctx: MekikAuthContext): Promise<MekikCredential> {
    const credential = this.#auth ? await this.#auth.authenticate(ctx) : {};
    const token = tokenOf(credential);
    if (token) this.#baseToken = token;
    const conversationId = this.options.conversationId;
    if (!conversationId) return credential;
    let bound = this.#freshBoundToken(conversationId);
    if (!bound && this.#channelScoped) bound = await this.#exchange(conversationId);
    if (!bound) return credential;
    if (credential.query) {
      const key = Object.keys(credential.query).find((k) => credential.query![k] === token) ?? "token";
      return { query: { ...credential.query, [key]: bound } };
    }
    return { token: bound };
  }

  async #onReject(error: MekikAuthError, ctx: MekikAuthContext): Promise<MekikAuthDecision> {
    const conversationId = this.options.conversationId;
    if (conversationId) this.#boundTokens.delete(conversationId);
    this.#baseToken = null;
    return this.#auth?.onReject ? this.#auth.onReject(error, ctx) : "fail";
  }

  #freshBoundToken(conversationId: string): string | null {
    const bound = this.#boundTokens.get(conversationId);
    return bound && bound.expiresAt - TOKEN_MARGIN_MS > Date.now() ? bound.token : null;
  }

  /** Exchange the app's token for one bound to the conversation (`GET /conversations/:id`). */
  async #exchange(conversationId: string): Promise<string | null> {
    const body = await this.#request(`/conversations/${encodeURIComponent(conversationId)}`);
    return this.#rememberBoundToken(conversationId, isRecord(body) ? body : {});
  }

  #rememberBoundToken(conversationId: string, body: Record<string, unknown>): string | null {
    if (typeof body.token !== "string" || !body.token) return null;
    const ttl = typeof body.expires_in === "number" ? body.expires_in : 1800;
    this.#boundTokens.set(conversationId, { token: body.token, expiresAt: Date.now() + ttl * 1000 });
    return body.token;
  }

  async #restToken(attempt = 0, previousError: MekikAuthError | null = null): Promise<string> {
    if (this.#baseToken) return this.#baseToken;
    const credential = this.#auth
      ? await this.#auth.authenticate({ url: this.options.url, attempt, previousError })
      : {};
    const token = tokenOf(credential);
    if (!token) {
      throw new Error("ConvergerConnector: the Converger API needs a token — pass `auth: new TokenAuth(...)`.");
    }
    this.#baseToken = token;
    return token;
  }

  async #request(path: string, init: RequestInit = {}, attempt = 0): Promise<unknown> {
    const token = await this.#restToken(attempt, attempt > 0 ? { code: "unauthorized", message: "" } : null);
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    headers.set("accept", "application/json");
    const res = await fetch(`${this.#apiUrl}${path}`, { ...init, headers });
    if (res.status === 401 && attempt === 0 && this.#auth) {
      // An expired token: ask the provider for a fresh one, once.
      this.#baseToken = null;
      return this.#request(path, init, 1);
    }
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      const error = isRecord(body) && isRecord(body.error) ? body.error : isRecord(body) ? body : {};
      const code = typeof error.code === "string" ? error.code : `http_${res.status}`;
      const message = typeof error.message === "string" ? error.message : res.statusText;
      throw new ConvergerApiError(res.status, code, `Converger API ${res.status} ${code}: ${message}`);
    }
    if (res.status === 204) return null;
    return res.json().catch(() => null);
  }

  #startPing(interval: number): void {
    if (this.#pingTimer !== null) clearInterval(this.#pingTimer);
    // The full protocol closes a connection that sends nothing for
    // idleTimeoutMs (4408): a mekik/1 client is kept alive by WebSocket pings,
    // a converger/1 client by its own `ping` frames.
    this.#pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: "ping" }));
    }, interval);
  }

  #stopTimers(): void {
    if (this.#pingTimer !== null) clearInterval(this.#pingTimer);
    this.#pingTimer = null;
    if (this.#readTimer !== null) clearTimeout(this.#readTimer);
    this.#readTimer = null;
  }
}
