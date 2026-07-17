import type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
  TypingHandler,
  HistoryResult,
  SurveyPayload,
  ToolCallHandler,
  GenUIChunkHandler,
} from "@chativa/core";
import type { OutgoingMessage } from "@chativa/core";
// Value import — deliberately from the `frames` subpath, not the package root:
// the root would inline all of core into this connector's standalone bundle.
import { parseChatFrame, createGenUIEventFrame } from "@chativa/core/frames";

export interface HttpConnectorOptions {
  /**
   * Base URL of your chat REST API.
   * The connector will POST to `{url}/messages` and poll GET `{url}/messages`.
   */
  url: string;
  /**
   * How often (ms) to poll for new messages. Default: 2000.
   */
  pollInterval?: number;
  /**
   * Extra headers sent with every request (e.g. Authorization).
   */
  headers?: Record<string, string>;
  /**
   * Maximum consecutive fetch errors before the connector sets status to error
   * and stops polling. Default: 5.
   */
  maxErrors?: number;
}

/**
 * HttpConnector — REST polling adapter.
 *
 * Protocol expectations (all responses are JSON):
 *
 * GET  {url}/messages?cursor={lastId}
 *   → { messages: IncomingMessage[], cursor?: string }
 *
 * POST {url}/messages
 *   → 200/201 (body ignored)
 *   Body: OutgoingMessage (JSON)
 *
 * GET  {url}/history?cursor={cursor}   (optional, for loadHistory)
 *   → { messages: IncomingMessage[], hasMore: boolean, cursor?: string }
 */
export class HttpConnector implements IConnector {
  readonly name = "http";
  readonly addSentToHistory = true;

  private options: Required<HttpConnectorOptions>;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _cursor: string | undefined;
  private _errorCount = 0;
  private _stopped = false;

  private messageHandler: MessageHandler | null = null;
  private connectHandler: ConnectHandler | null = null;
  private disconnectHandler: DisconnectHandler | null = null;
  private typingHandler: TypingHandler | null = null;
  private toolCallHandler: ToolCallHandler | null = null;
  private genUIChunkHandler: GenUIChunkHandler | null = null;

  constructor(options: HttpConnectorOptions) {
    this.options = {
      pollInterval: 2000,
      headers: {},
      maxErrors: 5,
      ...options,
    };
  }

  async connect(): Promise<void> {
    this._stopped = false;
    this._errorCount = 0;

    // Verify the endpoint is reachable
    await this._fetch(`${this.options.url}/messages`, { method: "GET" });

    this.connectHandler?.();
    this._startPolling();
  }

  async disconnect(): Promise<void> {
    this._stopped = true;
    this._stopPolling();
    this.disconnectHandler?.("user");
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    await this._fetch(`${this.options.url}/messages`, {
      method: "POST",
      body: JSON.stringify(message),
    });
  }

  /** POST the survey payload to `{url}/survey`. */
  async sendSurvey(payload: SurveyPayload): Promise<void> {
    await this._fetch(`${this.options.url}/survey`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async loadHistory(cursor?: string): Promise<HistoryResult> {
    const url = cursor
      ? `${this.options.url}/history?cursor=${encodeURIComponent(cursor)}`
      : `${this.options.url}/history`;
    const res = await this._fetch(url, { method: "GET" });
    return res as HistoryResult;
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
   * Forward a GenUI component event (form submit, card action, …) to the server
   * by POSTing the `genui_event` frame to `{url}/messages` — the outbound
   * counterpart of the inbound `genui` frame.
   */
  receiveComponentEvent(streamId: string, eventType: string, payload: unknown): void {
    // Fire-and-forget: a UI event must not block on the POST, and a failed send
    // is not worth tearing the conversation down over.
    void this._fetch(`${this.options.url}/messages`, {
      method: "POST",
      body: JSON.stringify(createGenUIEventFrame(streamId, eventType, payload)),
    }).catch(() => {});
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Route a rich frame (tool call, GenUI chunk, typing, HITL chips).
   * Returns true when the frame was handled and is not a chat message.
   */
  private _routeFrame(data: unknown): boolean {
    const frame = parseChatFrame(data, { idPrefix: "http" });
    switch (frame.kind) {
      case "tool_call":
        this.toolCallHandler?.(frame.toolCall);
        return true;
      case "genui":
        this.genUIChunkHandler?.(frame.streamId, frame.chunk, frame.done);
        return true;
      case "typing":
        this.typingHandler?.(frame.isTyping);
        return true;
      case "quick_reply":
        this.messageHandler?.(frame.message);
        return true;
      case "other":
        return false;
    }
  }

  private _startPolling(): void {
    this._pollTimer = setInterval(() => void this._poll(), this.options.pollInterval);
  }

  private _stopPolling(): void {
    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  private async _poll(): Promise<void> {
    if (this._stopped) return;

    const url = this._cursor
      ? `${this.options.url}/messages?cursor=${encodeURIComponent(this._cursor)}`
      : `${this.options.url}/messages`;

    try {
      const data = await this._fetch(url, { method: "GET" }) as {
        messages: Parameters<MessageHandler>[0][];
        cursor?: string;
      };

      this._errorCount = 0;

      if (data.cursor) this._cursor = data.cursor;

      // A poll batch may carry rich frames (tool calls, GenUI chunks, HITL
      // chips) interleaved with plain messages — the same vocabulary the
      // streaming connectors use, just delivered a batch at a time.
      for (const msg of data.messages ?? []) {
        if (this._routeFrame(msg)) continue;
        this.messageHandler?.(msg);
      }
    } catch {
      this._errorCount++;
      if (this._errorCount >= this.options.maxErrors) {
        this._stopPolling();
        this.disconnectHandler?.("error");
      }
    }
  }

  private async _fetch(url: string, init: RequestInit): Promise<unknown> {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...this.options.headers,
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      throw new Error(`HttpConnector: HTTP ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
}
