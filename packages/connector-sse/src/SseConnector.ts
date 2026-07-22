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

export interface SseConnectorOptions {
  /**
   * URL of the SSE endpoint (EventSource).
   * The server must stream `data: <json>\n\n` events.
   */
  url: string;
  /**
   * URL to POST outgoing messages to.
   * If omitted, defaults to `{url}` with method POST.
   */
  sendUrl?: string;
  /**
   * Extra headers sent with every POST request (e.g. Authorization).
   * Note: EventSource does not support custom headers natively.
   * Pass auth tokens via query params in `url` if needed.
   */
  headers?: Record<string, string>;
  /**
   * Whether to auto-reconnect when the SSE connection closes unexpectedly.
   * Default: true. (EventSource reconnects natively; this controls whether
   * the connector attempts to re-initialise on `error` events.)
   */
  reconnect?: boolean;
}

/**
 * SseConnector — Server-Sent Events adapter.
 *
 * Protocol expectations:
 *
 * SSE stream (GET {url}):
 *   Each event must be `data: <JSON>\n\n` where JSON matches one of:
 *     { "type": "message",   ... IncomingMessage fields }
 *     { "type": "typing",    "isTyping": boolean }
 *     { "type": "connected"  }            — optional, signals ready
 *
 * POST {sendUrl ?? url}
 *   Body: OutgoingMessage (JSON)
 *   → 200/201 (body ignored)
 *
 * GET  {url}/history?cursor={cursor}   (optional, for loadHistory)
 *   → { messages: IncomingMessage[], hasMore: boolean, cursor?: string }
 */
export class SseConnector implements IConnector {
  readonly name = "sse";
  readonly addSentToHistory = true;

  private options: Required<SseConnectorOptions>;
  private _es: EventSource | null = null;

  private messageHandler: MessageHandler | null = null;
  private connectHandler: ConnectHandler | null = null;
  private disconnectHandler: DisconnectHandler | null = null;
  private typingHandler: TypingHandler | null = null;
  private toolCallHandler: ToolCallHandler | null = null;
  private genUIChunkHandler: GenUIChunkHandler | null = null;

  constructor(options: SseConnectorOptions) {
    this.options = {
      sendUrl: options.url,
      headers: {},
      reconnect: true,
      ...options,
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const es = new EventSource(this.options.url);
      this._es = es;

      // Resolve as soon as the connection opens
      es.onopen = () => {
        this.connectHandler?.();
        resolve();
      };

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          this.disconnectHandler?.("error");
          if (!this.options.reconnect) {
            this._es = null;
          }
          // If reconnect is true, EventSource will attempt to re-open automatically
        }
        // Only reject if we haven't resolved yet (initial connection failure)
        reject(new Error("SseConnector: failed to open SSE connection."));
      };

      es.onmessage = (event: MessageEvent) => {
        // Remove the reject — connection is alive
        es.onerror = () => {
          if (es.readyState === EventSource.CLOSED) {
            this.disconnectHandler?.("error");
          }
        };

        try {
          const data = JSON.parse(event.data as string) as Record<string, unknown>;
          this._handleServerEvent(data);
        } catch {
          // Plain-text fallback — treat as a text message
          this.messageHandler?.({
            id: `sse-${Date.now()}`,
            type: "text",
            data: { text: event.data as string },
            timestamp: Date.now(),
          });
        }
      };

      // Listen for named event types the server may emit
      es.addEventListener("message", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data as string) as Record<string, unknown>;
          this._handleServerEvent(data);
        } catch { /* ignore */ }
      });

      es.addEventListener("connected", () => {
        this.connectHandler?.();
        resolve();
      });

      es.addEventListener("typing", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data as string) as { isTyping?: boolean };
          this.typingHandler?.(data.isTyping ?? false);
        } catch { /* ignore */ }
      });
    });
  }

  async disconnect(): Promise<void> {
    this._es?.close();
    this._es = null;
    this.disconnectHandler?.("user");
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    const res = await fetch(this.options.sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.options.headers,
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      throw new Error(`SseConnector: HTTP ${res.status} ${res.statusText}`);
    }
  }

  /** POST the survey alongside normal messages, tagged as `type: "survey"`. */
  async sendSurvey(payload: SurveyPayload): Promise<void> {
    const res = await fetch(this.options.sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.options.headers,
      },
      body: JSON.stringify({ type: "survey", ...payload }),
    });

    if (!res.ok) {
      throw new Error(`SseConnector: HTTP ${res.status} ${res.statusText}`);
    }
  }

  async loadHistory(cursor?: string): Promise<HistoryResult> {
    const base = this.options.url.replace(/\/+$/, "");
    const url = cursor
      ? `${base}/history?cursor=${encodeURIComponent(cursor)}`
      : `${base}/history`;

    const res = await fetch(url, {
      headers: { ...this.options.headers },
    });

    if (!res.ok) {
      throw new Error(`SseConnector: HTTP ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<HistoryResult>;
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
   * by POSTing the `genui_event` frame to `sendUrl` — the outbound counterpart
   * of the inbound `genui` frame, since an SSE stream is receive-only.
   */
  receiveComponentEvent(streamId: string, eventType: string, payload: unknown): void {
    // Fire-and-forget: a UI event must not block on the POST, and a failed send
    // is not worth tearing the conversation down over.
    void fetch(this.options.sendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.options.headers },
      body: JSON.stringify(createGenUIEventFrame(streamId, eventType, payload)),
    }).catch(() => {});
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _handleServerEvent(data: Record<string, unknown>): void {
    // Rich frames first — tool calls, GenUI chunks, typing and HITL chips.
    if (this._routeFrame(data)) return;

    if (data.type === "connected") {
      this.connectHandler?.();
      return;
    }

    // Default: treat as an IncomingMessage
    if (data.id && data.type) {
      this.messageHandler?.(data as unknown as Parameters<MessageHandler>[0]);
    }
  }

  /**
   * Route a rich frame (tool call, GenUI chunk, typing, HITL chips).
   * Returns true when the frame was handled and is not a chat message.
   */
  private _routeFrame(data: unknown): boolean {
    const frame = parseChatFrame(data, { idPrefix: "sse" });
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
}
