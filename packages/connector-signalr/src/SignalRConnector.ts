import type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
} from "@chativa/core";
import type { OutgoingMessage } from "@chativa/core";

export interface SignalRConnectorOptions {
  url: string;
  hubName?: string;
  receiveMethod?: string;
  sendMethod?: string;
  accessTokenFactory?: () => string | Promise<string>;
}

/**
 * SignalRConnector — Microsoft SignalR hub adapter.
 *
 * Requires @microsoft/signalr as a peer dependency.
 * Install: npm install @microsoft/signalr
 */
export class SignalRConnector implements IConnector {
  readonly name = "signalr";
  readonly addSentToHistory = true;

  // Typed as any to avoid requiring @microsoft/signalr as a hard dep
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private connection: any | null = null;
  private options: Required<SignalRConnectorOptions>;

  private messageHandler: MessageHandler | null = null;
  private connectHandler: ConnectHandler | null = null;
  private disconnectHandler: DisconnectHandler | null = null;

  constructor(options: SignalRConnectorOptions) {
    this.options = {
      hubName: "chat",
      receiveMethod: "ReceiveMessage",
      sendMethod: "SendMessage",
      accessTokenFactory: () => "",
      ...options,
    };
  }

  async connect(): Promise<void> {
    // Dynamic import so @microsoft/signalr is an optional peer dep
    const signalR = await import("@microsoft/signalr").catch(() => {
      throw new Error(
        "SignalRConnector: @microsoft/signalr not installed. " +
          "Run: npm install @microsoft/signalr"
      );
    });

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(this.options.url, {
        accessTokenFactory: this.options.accessTokenFactory,
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on(
      this.options.receiveMethod,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data: any) => {
        this.messageHandler?.(
          typeof data === "object" && data !== null
            ? data
            : {
                id: `sr-${Date.now()}`,
                type: "text",
                data: { text: String(data) },
                timestamp: Date.now(),
              }
        );
      }
    );

    this.connection.onclose((error?: Error) => {
      this.disconnectHandler?.(error?.message);
    });

    await this.connection.start();
    this.connectHandler?.();
  }

  async disconnect(): Promise<void> {
    await this.connection?.stop();
    this.connection = null;
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    if (!this.connection) {
      throw new Error("SignalRConnector: not connected.");
    }
    await this.connection.invoke(this.options.sendMethod, message);
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
