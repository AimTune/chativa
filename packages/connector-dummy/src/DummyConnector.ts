import type {
  IConnector,
  MessageHandler,
  DisconnectHandler,
} from "@chativa/core";
import type { OutgoingMessage } from "@chativa/core";

/**
 * DummyConnector — local mock connector for development and testing.
 * Automatically replies after a configurable delay.
 * `connectDelay` simulates a real connection handshake (default 2000ms).
 * Sending "/disconnect" as a message triggers a graceful disconnect.
 */
export class DummyConnector implements IConnector {
  readonly name = "dummy";
  readonly addSentToHistory = true;

  private messageHandler: MessageHandler | null = null;
  private disconnectHandler: DisconnectHandler | null = null;
  private replyDelay: number;
  private connectDelay: number;

  constructor(options: { replyDelay?: number; connectDelay?: number } = {}) {
    this.replyDelay = options.replyDelay ?? 500;
    this.connectDelay = options.connectDelay ?? 2000;
  }

  async connect(): Promise<void> {
    if (this.connectDelay > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, this.connectDelay));
    }
  }

  async disconnect(): Promise<void> {
    this.messageHandler = null;
    this.disconnectHandler?.("user");
    this.disconnectHandler = null;
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    const text = (message.data as { text?: string }).text ?? "";

    if (text.trim() === "/disconnect") {
      await this.disconnect();
      return;
    }

    setTimeout(() => {
      this.messageHandler?.({
        id: `dummy-reply-${Date.now()}`,
        type: "text",
        data: { text: `Echo: ${text}` },
        timestamp: Date.now(),
      });
    }, this.replyDelay);
  }

  onMessage(callback: MessageHandler): void {
    this.messageHandler = callback;
  }

  onDisconnect(callback: DisconnectHandler): void {
    this.disconnectHandler = callback;
  }
}
