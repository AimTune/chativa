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

export interface LineConnectorOptions {
  /** chativa-line WebSocket endpoint, e.g. "ws://localhost:8790/chat". */
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  /** Queue outgoing messages while the socket is down and flush on (re)connect. */
  queueOfflineMessages?: boolean;
}

/**
 * LineConnector — adapter for chativa-line bridges
 * (https://github.com/AimTune — server-side counterpart of Chativa).
 *
 * Speaks the chativa-line wire protocol over a native WebSocket:
 *
 * - `{ type: "text", ... }`       → regular bot message; `actions` chips pass
 *   through untouched, which is how chativa-line renders human-in-the-loop
 *   (interrupt) questions.
 * - `{ type: "tool_call", data }` → ToolCall lifecycle frame (same `id`
 *   upserted as running → completed/error) → `onToolCall`.
 * - `{ type: "run", data: { status } }` → run lifecycle; mapped to the typing
 *   indicator (`started` → typing on, `finished`/`error` → typing off).
 * - `{ type: "genui", streamId, chunk, done }` → Generative UI chunk; mounts a
 *   GenUIRegistry component inline (e.g. weather card, PDF download card) via
 *   `onGenUIChunk`.
 *
 * Extras over the plain WebSocket connector: typing from run lifecycle and an
 * offline outbound queue flushed on reconnect.
 */
export class LineConnector implements IConnector {
  readonly name = "line";
  readonly addSentToHistory = true;

  private ws: WebSocket | null = null;
  private options: Required<LineConnectorOptions>;

  private messageHandler: MessageHandler | null = null;
  private connectHandler: ConnectHandler | null = null;
  private disconnectHandler: DisconnectHandler | null = null;
  private typingHandler: TypingHandler | null = null;
  private toolCallHandler: ToolCallHandler | null = null;
  private genUIChunkHandler: GenUIChunkHandler | null = null;

  private reconnectAttempts = 0;
  private queue: string[] = [];

  constructor(options: LineConnectorOptions) {
    this.options = {
      protocols: [],
      reconnect: true,
      reconnectDelay: 2000,
      maxReconnectAttempts: 5,
      queueOfflineMessages: true,
      ...options,
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.options.url, this.options.protocols);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.flushQueue();
        this.connectHandler?.();
        resolve();
      };

      this.ws.onerror = (event) => {
        reject(new Error(`LineConnector WebSocket error: ${JSON.stringify(event)}`));
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.routeFrame(event.data as string);
      };

      this.ws.onclose = (event) => {
        // The run may have died with the socket — don't leave typing stuck on.
        this.typingHandler?.(false);
        this.disconnectHandler?.(event.reason);
        if (
          this.options.reconnect &&
          this.reconnectAttempts < this.options.maxReconnectAttempts
        ) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect().catch(() => {}), this.options.reconnectDelay);
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    this.options.reconnect = false;
    this.ws?.close();
    this.ws = null;
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    this.sendOrQueue(JSON.stringify(message));
  }

  /** Send the survey as a JSON frame with discriminator `{ type: "survey", ... }`. */
  async sendSurvey(payload: SurveyPayload): Promise<void> {
    this.sendOrQueue(JSON.stringify({ type: "survey", ...payload }));
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

  // ── internals ────────────────────────────────────────────────────────

  private routeFrame(raw: string): void {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      this.messageHandler?.({
        id: `line-${Date.now()}`,
        type: "text",
        data: { text: raw },
        timestamp: Date.now(),
      });
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

    // A bot message ends any visible "working" state.
    this.typingHandler?.(false);
    this.messageHandler?.(data as never);
  }

  private sendOrQueue(payload: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      return;
    }
    if (this.options.queueOfflineMessages) {
      this.queue.push(payload);
    } else {
      throw new Error("LineConnector: not connected.");
    }
  }

  private flushQueue(): void {
    while (this.queue.length && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(this.queue.shift()!);
    }
  }
}
