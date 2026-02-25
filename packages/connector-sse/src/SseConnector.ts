import type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
  TypingHandler,
  HistoryResult,
} from "@chativa/core";
import type { OutgoingMessage } from "@chativa/core";

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

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _handleServerEvent(data: Record<string, unknown>): void {
    const type = data.type as string | undefined;

    if (type === "typing") {
      this.typingHandler?.((data.isTyping as boolean | undefined) ?? false);
      return;
    }

    if (type === "connected") {
      this.connectHandler?.();
      return;
    }

    // Default: treat as an IncomingMessage
    if (data.id && data.type) {
      this.messageHandler?.(data as unknown as Parameters<MessageHandler>[0]);
    }
  }
}
