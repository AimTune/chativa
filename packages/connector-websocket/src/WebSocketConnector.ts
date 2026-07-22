import type {
  IConnector,
  IncomingMessage,
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

export interface WebSocketConnectorOptions {
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

/**
 * WebSocketConnector — native browser WebSocket adapter.
 */
export class WebSocketConnector implements IConnector {
  readonly name = "websocket";
  readonly addSentToHistory = true;

  private ws: WebSocket | null = null;
  private options: Required<WebSocketConnectorOptions>;

  private messageHandler: MessageHandler | null = null;
  private connectHandler: ConnectHandler | null = null;
  private disconnectHandler: DisconnectHandler | null = null;
  private typingHandler: TypingHandler | null = null;
  private toolCallHandler: ToolCallHandler | null = null;
  private genUIChunkHandler: GenUIChunkHandler | null = null;

  private reconnectAttempts = 0;

  constructor(options: WebSocketConnectorOptions) {
    this.options = {
      protocols: [],
      reconnect: true,
      reconnectDelay: 2000,
      maxReconnectAttempts: 5,
      ...options,
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.options.url, this.options.protocols);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.connectHandler?.();
        resolve();
      };

      this.ws.onerror = (event) => {
        reject(new Error(`WebSocket error: ${JSON.stringify(event)}`));
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data: unknown = JSON.parse(event.data as string);
          if (this.routeFrame(data)) return;
          this.messageHandler?.(data as IncomingMessage);
        } catch {
          this.messageHandler?.({
            id: `ws-${Date.now()}`,
            type: "text",
            data: { text: event.data as string },
            timestamp: Date.now(),
          });
        }
      };

      this.ws.onclose = (event) => {
        this.disconnectHandler?.(event.reason);
        if (
          this.options.reconnect &&
          this.reconnectAttempts < this.options.maxReconnectAttempts
        ) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), this.options.reconnectDelay);
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    this.ws?.close();
    this.ws = null;
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocketConnector: not connected.");
    }
    this.ws.send(JSON.stringify(message));
  }

  /** Send the survey as a JSON frame with discriminator `{ type: "survey", ... }`. */
  async sendSurvey(payload: SurveyPayload): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocketConnector: not connected.");
    }
    this.ws.send(JSON.stringify({ type: "survey", ...payload }));
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
   * as `{ type: "genui_event", streamId, eventType, payload }` — the outbound
   * counterpart of the inbound `genui` frame.
   */
  receiveComponentEvent(streamId: string, eventType: string, payload: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(createGenUIEventFrame(streamId, eventType, payload)));
  }

  /**
   * Route a rich frame (tool call, GenUI chunk, typing, HITL chips).
   * Returns true when the frame was handled and is not a chat message.
   */
  private routeFrame(data: unknown): boolean {
    const frame = parseChatFrame(data, { idPrefix: "ws" });
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
