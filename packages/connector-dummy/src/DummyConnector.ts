import type {
  IConnector,
  MessageHandler,
  DisconnectHandler,
  TypingHandler,
  IncomingMessage,
  MessageStatus,
  HistoryResult,
  FeedbackType,
  MessageStatusHandler,
  GenUIChunkHandler,
  AIChunk,
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
  private typingHandler: TypingHandler | null = null;
  private statusHandler: MessageStatusHandler | null = null;
  private genUIChunkHandler: GenUIChunkHandler | null = null;
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

    // Trigger demo GenUI streams by command prefix (most-specific first)
    const trimmed = text.trim();
    if (trimmed.startsWith("/genui-weather") && this.genUIChunkHandler) {
      this._streamWeatherDemo(message.id);
      return;
    }
    if (trimmed.startsWith("/genui-form") && this.genUIChunkHandler) {
      this._streamAppointmentFormDemo(message.id);
      return;
    }
    if (trimmed.startsWith("/genui") && this.genUIChunkHandler) {
      this._streamGenUIDemo(message.id);
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

  private _streamGenUIDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "Here are some options for you:", id: 1 },
        wait: 400,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-card",
          props: {
            title: "Pro Plan",
            description: "Unlimited API calls, priority support and early access features.",
            actions: [
              { label: "Select", value: "select_pro" },
              { label: "Learn more", value: "learn_pro" },
            ],
          },
          id: 2,
        },
        wait: 500,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-form",
          props: {
            title: "Get in touch",
            buttonText: "Send",
            fields: [
              { name: "name", label: "Full Name", type: "text", placeholder: "Jane Doe" },
              { name: "email", label: "Email", type: "email", placeholder: "jane@example.com" },
            ],
          },
          id: 3,
        },
        wait: 700,
        done: false,
      },
      // Success event targets the form (id: 3)
      {
        chunk: {
          type: "event",
          name: "form_success",
          payload: { message: "Thanks! We'll be in touch shortly." },
          id: 4,
          for: 3,
        },
        wait: 1800,
        done: true,
      },
    ];

    let accumulated = 0;
    chunks.forEach(({ chunk, wait, done }) => {
      accumulated += wait;
      setTimeout(() => handler(streamId, chunk, done), accumulated);
    });
  }

  private _streamWeatherDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "Here's the current weather for Istanbul:", id: 1 },
        wait: 300,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "weather",
          props: {
            city: "Istanbul",
            country: "TR",
            temp: 22,
            unit: "C",
            condition: "Partly Cloudy",
            humidity: 65,
            wind: 12,
          },
          id: 2,
        },
        wait: 400,
        done: true,
      },
    ];

    let accumulated = 0;
    chunks.forEach(({ chunk, wait, done }) => {
      accumulated += wait;
      setTimeout(() => handler(streamId, chunk, done), accumulated);
    });
  }

  private _streamAppointmentFormDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "Please fill in the form to book your appointment:", id: 1 },
        wait: 300,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "appointment-form",
          props: {
            title: "Book an Appointment",
            buttonText: "Book Now",
            fields: [
              { name: "name", label: "Full Name", type: "text", placeholder: "Jane Doe" },
              { name: "date", label: "Preferred Date", type: "date" },
              { name: "notes", label: "Notes", type: "text", placeholder: "Optional notes..." },
            ],
          },
          id: 2,
        },
        wait: 400,
        // Stream stays open (done: false) — form_success fires via receiveComponentEvent
        done: false,
      },
    ];

    let accumulated = 0;
    chunks.forEach(({ chunk, wait, done }) => {
      accumulated += wait;
      setTimeout(() => handler(streamId, chunk, done), accumulated);
    });
  }

  /**
   * Directly trigger a GenUI demo stream — used by the sandbox demo buttons.
   * @param command  "weather" | "form" | "genui"
   */
  triggerGenUI(command: string): void {
    if (!this.genUIChunkHandler) return;
    const streamId = `genui-trigger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (command === "weather") {
      this._streamWeatherDemo(streamId);
    } else if (command === "form") {
      this._streamAppointmentFormDemo(streamId);
    } else {
      this._streamGenUIDemo(streamId);
    }
  }

  receiveComponentEvent(streamId: string, eventType: string, _payload: unknown): void {
    if (eventType === "form_submit") {
      // Simulate server processing then respond with success
      setTimeout(() => {
        this.genUIChunkHandler?.(
          streamId,
          {
            type: "event",
            name: "form_success",
            payload: { code: "APT-7X4K2", message: "Appointment successfully booked." },
            id: 10,
            for: 2,
          },
          true, // done — marks the stream complete
        );
      }, 1000);
    }
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

  onGenUIChunk(callback: GenUIChunkHandler): void {
    this.genUIChunkHandler = callback;
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
