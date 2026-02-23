import type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
} from "../../domain/ports/IConnector";
import type { OutgoingMessage } from "../../domain/entities/Message";

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
          const data = JSON.parse(event.data as string);
          this.messageHandler?.(data);
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

  onMessage(callback: MessageHandler): void {
    this.messageHandler = callback;
  }

  onConnect(callback: ConnectHandler): void {
    this.connectHandler = callback;
  }

  onDisconnect(callback: DisconnectHandler): void {
    this.disconnectHandler = callback;
  }
}
