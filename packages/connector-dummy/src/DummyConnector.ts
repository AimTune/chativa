import type {
  IConnector,
  MessageHandler,
  DisconnectHandler,
  TypingHandler,
  IncomingMessage,
  MessageStatus,
  HistoryResult,
} from "@chativa/core";
import type { FeedbackType, MessageStatusHandler } from "../../core/src/domain/ports/IConnector";
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
  private typingHandler: TypingHandler | null = null;
  private statusHandler: MessageStatusHandler | null = null;
  private replyDelay: number;
  private connectDelay: number;

  /** Fake history pages — two pages of 5 messages each. */
  private static _historyPages: IncomingMessage[][] = [
    Array.from({ length: 5 }, (_, i) => ({
      id: `history-p1-${i}`,
      type: "text",
      from: i % 2 === 0 ? ("bot" as const) : ("user" as const),
      data: { text: i % 2 === 0 ? `Earlier bot message ${i + 1}` : `Earlier user message ${i + 1}` },
      timestamp: Date.now() - (600 - i * 60) * 1000,
    })),
    Array.from({ length: 5 }, (_, i) => ({
      id: `history-p2-${i}`,
      type: "text",
      from: i % 2 === 0 ? ("bot" as const) : ("user" as const),
      data: { text: i % 2 === 0 ? `Much earlier bot message ${i + 1}` : `Much earlier user message ${i + 1}` },
      timestamp: Date.now() - (1200 - i * 60) * 1000,
    })),
  ];

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

    this.typingHandler?.(true);
    setTimeout(() => {
      this.typingHandler?.(false);
      const replyId = `dummy-reply-${Date.now()}`;
      this.messageHandler?.({
        id: replyId,
        type: "text",
        data: { text: `Echo: ${text}` },
        timestamp: Date.now(),
      });
      // Simulate "read" status for the sent message after a short delay
      if (this.statusHandler) {
        setTimeout(() => {
          this.statusHandler?.(message.id, "read" as MessageStatus);
        }, 1500);
      }
    }, this.replyDelay);
  }

  onMessage(callback: MessageHandler): void {
    this.messageHandler = callback;
  }

  onDisconnect(callback: DisconnectHandler): void {
    this.disconnectHandler = callback;
  }

  onTyping(callback: TypingHandler): void {
    this.typingHandler = callback;
  }

  onMessageStatus(callback: MessageStatusHandler): void {
    this.statusHandler = callback;
  }

  async sendFeedback(messageId: string, feedback: FeedbackType): Promise<void> {
    console.log(`[DummyConnector] Feedback received — messageId: ${messageId}, feedback: ${feedback}`);
  }

  async sendFile(file: File, metadata?: Record<string, unknown>): Promise<void> {
    console.log(`[DummyConnector] File received — name: ${file.name}, size: ${file.size}`, metadata);
    // Echo back a file message so the UI reflects the upload
    setTimeout(() => {
      this.messageHandler?.({
        id: `dummy-file-reply-${Date.now()}`,
        type: "file",
        data: {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          url: URL.createObjectURL(file),
          caption: (metadata?.caption as string | undefined) ?? undefined,
        },
        timestamp: Date.now(),
      });
    }, this.replyDelay);
  }

  async loadHistory(cursor?: string): Promise<HistoryResult> {
    await new Promise<void>((resolve) => setTimeout(resolve, 400));
    const pageIndex = cursor ? parseInt(cursor, 10) : 0;
    const page = DummyConnector._historyPages[pageIndex];
    if (!page) {
      return { messages: [], hasMore: false };
    }
    const nextPage = pageIndex + 1;
    return {
      messages: [...page].reverse(), // oldest-first within page
      hasMore: nextPage < DummyConnector._historyPages.length,
      cursor: nextPage < DummyConnector._historyPages.length ? String(nextPage) : undefined,
    };
  }

  /**
   * Directly inject a bot message — used by the sandbox demo buttons.
   * Does not go through the extension pipeline.
   */
  injectMessage(msg: Omit<IncomingMessage, "id" | "timestamp">): void {
    this.messageHandler?.({
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...msg,
    });
  }
}
