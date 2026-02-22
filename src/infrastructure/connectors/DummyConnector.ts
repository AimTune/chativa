import type { IConnector, MessageHandler } from "../../domain/ports/IConnector";
import type { OutgoingMessage } from "../../domain/entities/Message";

/**
 * DummyConnector — local mock connector for development and testing.
 * Automatically replies after a configurable delay.
 */
export class DummyConnector implements IConnector {
  readonly name = "dummy";
  readonly addSentToHistory = true;

  private messageHandler: MessageHandler | null = null;
  private replyDelay: number;

  constructor(options: { replyDelay?: number } = {}) {
    this.replyDelay = options.replyDelay ?? 500;
  }

  async connect(): Promise<void> {
    // No-op — dummy connector is always "connected"
  }

  async disconnect(): Promise<void> {
    this.messageHandler = null;
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    setTimeout(() => {
      this.messageHandler?.({
        id: `dummy-reply-${Date.now()}`,
        type: "text",
        data: {
          text: `Echo: ${(message.data as { text?: string }).text ?? ""}`,
        },
        timestamp: Date.now(),
      });
    }, this.replyDelay);
  }

  onMessage(callback: MessageHandler): void {
    this.messageHandler = callback;
  }
}
