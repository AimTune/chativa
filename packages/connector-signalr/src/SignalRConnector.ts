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

export interface SignalRConnectorOptions {
  url: string;
  hubName?: string;
  receiveMethod?: string;
  sendMethod?: string;
  /** Hub method used by `sendSurvey`. Default: "SendSurvey". */
  surveyMethod?: string;
  /**
   * Hub method invoked to send a GenUI component event back to the server.
   * Default: "SendGenUIEvent". Called with the `genui_event` frame.
   */
  genUIEventMethod?: string;
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
  private typingHandler: TypingHandler | null = null;
  private toolCallHandler: ToolCallHandler | null = null;
  private genUIChunkHandler: GenUIChunkHandler | null = null;

  constructor(options: SignalRConnectorOptions) {
    this.options = {
      hubName: "chat",
      receiveMethod: "ReceiveMessage",
      sendMethod: "SendMessage",
      surveyMethod: "SendSurvey",
      genUIEventMethod: "SendGenUIEvent",
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

    // One hub method carries everything: chat messages and the rich frames
    // (tool calls, GenUI chunks, typing, HITL chips) alike. A hub that only
    // ever sends plain messages keeps working untouched — those fall through
    // as `other`.
    this.connection.on(
      this.options.receiveMethod,
      (data: unknown) => {
        if (typeof data !== "object" || data === null) {
          this.messageHandler?.({
            id: `sr-${Date.now()}`,
            type: "text",
            data: { text: String(data) },
            timestamp: Date.now(),
          });
          return;
        }
        if (this.routeFrame(data)) return;
        this.messageHandler?.(data as IncomingMessage);
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

  async sendSurvey(payload: SurveyPayload): Promise<void> {
    if (!this.connection) {
      throw new Error("SignalRConnector: not connected.");
    }
    await this.connection.invoke(this.options.surveyMethod, payload);
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
   * Forward a GenUI component event (form submit, card action, …) to the hub by
   * invoking `genUIEventMethod` with the `genui_event` frame — the outbound
   * counterpart of the inbound `genui` frame.
   */
  receiveComponentEvent(streamId: string, eventType: string, payload: unknown): void {
    // Fire-and-forget: the UI event must not block on the hub round-trip, and
    // a failed send is not worth tearing the conversation down over.
    void this.connection
      ?.invoke(this.options.genUIEventMethod, createGenUIEventFrame(streamId, eventType, payload))
      .catch(() => {});
  }

  /**
   * Route a rich frame (tool call, GenUI chunk, typing, HITL chips).
   * Returns true when the frame was handled and is not a chat message.
   */
  private routeFrame(data: unknown): boolean {
    const frame = parseChatFrame(data, { idPrefix: "sr" });
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
