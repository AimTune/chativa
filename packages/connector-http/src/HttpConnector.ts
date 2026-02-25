import type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
  HistoryResult,
} from "@chativa/core";
import type { OutgoingMessage } from "@chativa/core";

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

  // ── Private helpers ─────────────────────────────────────────────────────────

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

      for (const msg of data.messages ?? []) {
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
