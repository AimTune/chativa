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
  Conversation,
  ConversationHandler,
} from "@chativa/core";
import type { OutgoingMessage } from "@chativa/core";

/**
 * DummyConnector — local mock connector for development and testing.
 * Automatically replies after a configurable delay.
 * `connectDelay` simulates a real connection handshake (default 2000ms).
 * Sending "/disconnect" as a message triggers a graceful disconnect.
 */
export class DummyConnector implements IConnector {
  readonly name: string;
  readonly addSentToHistory = true;

  private messageHandler: MessageHandler | null = null;
  private disconnectHandler: DisconnectHandler | null = null;
  private typingHandler: TypingHandler | null = null;
  private statusHandler: MessageStatusHandler | null = null;
  private genUIChunkHandler: GenUIChunkHandler | null = null;
  private conversationHandler: ConversationHandler | null = null;
  private replyDelay: number;
  private connectDelay: number;

  // ── Multi-conversation demo state ─────────────────────────────────────

  /** Mutable demo conversations list. Reset on each new DummyConnector instance. */
  private _conversations: Conversation[];
  /** Track which conversations have received their first-visit greeting. */
  private _visitedConversations = new Set<string>();

  private static _makeDemoConversations(): Conversation[] {
    const now = Date.now();
    return [
      {
        id: "conv-1",
        title: "Support Request",
        contact: "Alice Johnson",
        lastMessage: "Hi, I need help with my order",
        lastMessageAt: now - 3 * 60 * 1000,
        unreadCount: 2,
        status: "open",
      },
      {
        id: "conv-2",
        title: "Billing Question",
        contact: "Bob Martinez",
        lastMessage: "Why was I charged twice?",
        lastMessageAt: now - 15 * 60 * 1000,
        unreadCount: 0,
        status: "pending",
      },
      {
        id: "conv-3",
        title: "Account Issue",
        contact: "Carol Smith",
        lastMessage: "I can't log in to my account",
        lastMessageAt: now - 2 * 60 * 60 * 1000,
        unreadCount: 1,
        status: "open",
      },
    ];
  }

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

  constructor(options: { replyDelay?: number; connectDelay?: number; name?: string } = {}) {
    this.name = options.name ?? "dummy";
    this.replyDelay = options.replyDelay ?? 500;
    this.connectDelay = options.connectDelay ?? 2000;
    this._conversations = DummyConnector._makeDemoConversations();
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
          component: "genui-appointment-form",
          props: {
            fields: [
              { name: "name", label: "Full Name", type: "text", placeholder: "Jane Doe" },
              { name: "date", label: "Preferred Date", type: "date" },
              { name: "notes", label: "Notes", type: "text", placeholder: "Optional notes..." },
            ],
          },
          id: 2,
        },
        wait: 400,
        done: false,
      },
      // form_success pre-defined in the stream — form uses _pendingSuccess on submit (no round-trip)
      {
        chunk: {
          type: "event",
          name: "form_success",
          payload: { code: "APT-7X4K2" },
          id: 3,
          for: 2,
        },
        wait: 100,
        done: true,
      },
    ];

    let accumulated = 0;
    chunks.forEach(({ chunk, wait, done }) => {
      accumulated += wait;
      setTimeout(() => handler(streamId, chunk, done), accumulated);
    });
  }

  private _streamAlertDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "Here are some status notifications:", id: 1 },
        wait: 300,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-alert",
          props: { variant: "success", title: "Payment Received", message: "Your payment of $49.00 was processed successfully." },
          id: 2,
        },
        wait: 400,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-alert",
          props: { variant: "warning", title: "Session Expiring", message: "Your session will expire in 5 minutes. Please save your work." },
          id: 3,
        },
        wait: 500,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-alert",
          props: { variant: "error", title: "Connection Failed", message: "Unable to reach the server. Please check your connection and try again." },
          id: 4,
        },
        wait: 500,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-alert",
          props: { variant: "info", title: "Maintenance Window", message: "Scheduled maintenance on Saturday from 02:00–04:00 UTC." },
          id: 5,
        },
        wait: 500,
        done: true,
      },
    ];

    let accumulated = 0;
    chunks.forEach(({ chunk, wait, done }) => {
      accumulated += wait;
      setTimeout(() => handler(streamId, chunk, done), accumulated);
    });
  }

  private _streamQuickRepliesDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "How would you like to proceed?", id: 1 },
        wait: 300,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-quick-replies",
          props: {
            label: "Choose an option:",
            items: [
              { label: "Track my order", value: "track_order" },
              { label: "Return a product", value: "return_product" },
              { label: "Talk to an agent", value: "talk_agent" },
              { label: "Check FAQ", value: "faq" },
            ],
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

  private _streamListDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "Here's a summary of your recent activity:", id: 1 },
        wait: 300,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-list",
          props: {
            title: "Recent Orders",
            ordered: true,
            items: [
              { text: "Order #4821 — MacBook Pro", secondary: "Delivered · Jan 15" },
              { text: "Order #4756 — AirPods Max", secondary: "In transit · ETA Jan 28" },
              { text: "Order #4690 — iPhone Case", secondary: "Processing · Jan 22" },
            ],
          },
          id: 2,
        },
        wait: 400,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-list",
          props: {
            title: "Recommended Next Steps",
            ordered: false,
            items: [
              { text: "Confirm your shipping address", icon: "📦" },
              { text: "Add a payment method", icon: "💳" },
              { text: "Enable order notifications", icon: "🔔" },
            ],
          },
          id: 3,
        },
        wait: 500,
        done: true,
      },
    ];

    let accumulated = 0;
    chunks.forEach(({ chunk, wait, done }) => {
      accumulated += wait;
      setTimeout(() => handler(streamId, chunk, done), accumulated);
    });
  }

  private _streamTableDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "Here's a comparison of available plans:", id: 1 },
        wait: 300,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-table",
          props: {
            title: "Plan Comparison",
            columns: ["Plan", "Price", "API Calls", "Support"],
            rows: [
              ["Free",       "$0/mo",   "1,000/mo",    "Community"],
              ["Starter",    "$19/mo",  "50,000/mo",   "Email"],
              ["Pro",        "$49/mo",  "500,000/mo",  "Priority"],
              ["Enterprise", "Custom",  "Unlimited",   "Dedicated"],
            ],
          },
          id: 2,
        },
        wait: 400,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-table",
          props: {
            title: "Your Account Summary",
            rows: [
              ["Plan",          "Pro"],
              ["Billing cycle", "Monthly"],
              ["Next invoice",  "Feb 1, 2026"],
              ["API usage",     "312,450 / 500,000"],
            ],
          },
          id: 3,
        },
        wait: 500,
        done: true,
      },
    ];

    let accumulated = 0;
    chunks.forEach(({ chunk, wait, done }) => {
      accumulated += wait;
      setTimeout(() => handler(streamId, chunk, done), accumulated);
    });
  }

  private _streamRatingDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "How was your experience with our support team?", id: 1 },
        wait: 300,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-rating",
          props: { title: "Rate your experience", maxStars: 5 },
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

  private _streamProgressDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "Here's the current status of your onboarding:", id: 1 },
        wait: 300,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-progress",
          props: { label: "Profile Setup", value: 100, caption: "Complete", variant: "success" },
          id: 2,
        },
        wait: 400,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-progress",
          props: { label: "API Integration", value: 65, caption: "In progress — 2 steps remaining" },
          id: 3,
        },
        wait: 400,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-progress",
          props: { label: "Team Invitations", value: 30, caption: "3 of 10 members joined", variant: "warning" },
          id: 4,
        },
        wait: 400,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-progress",
          props: { label: "Billing Setup", value: 0, caption: "Not started", variant: "error" },
          id: 5,
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

  private _streamDatePickerDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const today = new Date().toISOString().slice(0, 10);
    const maxDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "Please select a date for your appointment:", id: 1 },
        wait: 300,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-date-picker",
          props: { label: "Preferred appointment date", min: today, max: maxDate },
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

  private _streamChartDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "Here are your sales analytics:", id: 1 },
        wait: 300,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-chart",
          props: {
            type: "bar",
            title: "Monthly Revenue (K$)",
            labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
            datasets: [
              { label: "2025", data: [42, 38, 55, 61, 48, 72] },
              { label: "2026", data: [50, 45, 60, 75, 58, 88] },
            ],
          },
          id: 2,
        },
        wait: 400,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-chart",
          props: {
            type: "line",
            title: "Daily Active Users",
            labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            datasets: [
              { label: "This week", data: [1200, 1450, 1380, 1600, 1520, 980, 840] },
            ],
          },
          id: 3,
        },
        wait: 500,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-chart",
          props: {
            type: "pie",
            title: "Revenue by Region",
            datasets: [
              { label: "Europe", data: [38] },
              { label: "Americas", data: [31] },
              { label: "Asia", data: [22] },
              { label: "Other", data: [9] },
            ],
          },
          id: 4,
        },
        wait: 500,
        done: true,
      },
    ];

    let accumulated = 0;
    chunks.forEach(({ chunk, wait, done }) => {
      accumulated += wait;
      setTimeout(() => handler(streamId, chunk, done), accumulated);
    });
  }

  private _streamStepsDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "Here's the current status of your order:", id: 1 },
        wait: 300,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-steps",
          props: {
            steps: [
              { label: "Order placed", status: "done" },
              { label: "Payment confirmed", status: "done" },
              { label: "Preparing shipment", status: "active", description: "Your items are being packed and labeled." },
              { label: "Out for delivery", status: "pending" },
              { label: "Delivered", status: "pending" },
            ],
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

  private _streamImageGalleryDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: { type: "text", content: "Here are some product photos:", id: 1 },
        wait: 300,
        done: false,
      },
      {
        chunk: {
          type: "ui",
          component: "genui-image-gallery",
          props: {
            columns: 3,
            images: [
              { src: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80", alt: "Camera", caption: "Polaroid" },
              { src: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80", alt: "Headphones", caption: "Audio" },
              { src: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80", alt: "Watch", caption: "Premium Watch" },
              { src: "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=300&q=80", alt: "Perfume" },
              { src: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=300&q=80", alt: "Sneakers", caption: "Sport" },
              { src: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=300&q=80", alt: "Laptop", caption: "Tech" },
            ],
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

  private _streamTypewriterDemo(streamId: string): void {
    const handler = this.genUIChunkHandler;
    if (!handler) return;

    const chunks: Array<{ chunk: AIChunk; wait: number; done: boolean }> = [
      {
        chunk: {
          type: "ui",
          component: "genui-typewriter",
          props: {
            content: "Welcome to Chativa! I'm your AI assistant, ready to help you with orders, support requests, and anything else you need. Type a message to get started.",
            speed: 25,
            cursor: true,
          },
          id: 1,
        },
        wait: 200,
        done: true,
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
   */
  triggerGenUI(command: string): void {
    if (!this.genUIChunkHandler) return;
    const streamId = `genui-trigger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    switch (command) {
      case "weather":       this._streamWeatherDemo(streamId); break;
      case "form":          this._streamAppointmentFormDemo(streamId); break;
      case "alert":         this._streamAlertDemo(streamId); break;
      case "quick-replies": this._streamQuickRepliesDemo(streamId); break;
      case "list":          this._streamListDemo(streamId); break;
      case "table":         this._streamTableDemo(streamId); break;
      case "rating":        this._streamRatingDemo(streamId); break;
      case "progress":      this._streamProgressDemo(streamId); break;
      case "date-picker":   this._streamDatePickerDemo(streamId); break;
      case "chart":         this._streamChartDemo(streamId); break;
      case "steps":         this._streamStepsDemo(streamId); break;
      case "image-gallery": this._streamImageGalleryDemo(streamId); break;
      case "typewriter":    this._streamTypewriterDemo(streamId); break;
      default:              this._streamGenUIDemo(streamId); break;
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
            payload: { code: "APT-7X4K2" },
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

  // ── Multi-conversation (IConnector optional methods) ──────────────────

  async listConversations(): Promise<Conversation[]> {
    return [...this._conversations];
  }

  async createConversation(title?: string): Promise<Conversation> {
    const id = `conv-${Date.now()}`;
    const conv: Conversation = {
      id,
      title: title ?? "New Conversation",
      contact: "New Customer",
      lastMessage: "",
      lastMessageAt: Date.now(),
      unreadCount: 0,
      status: "open",
    };
    this._conversations.push(conv);
    return conv;
  }

  async switchConversation(conversationId: string): Promise<void> {
    // Inject a greeting on first visit to this conversation
    if (!this._visitedConversations.has(conversationId)) {
      this._visitedConversations.add(conversationId);
      const conv = this._conversations.find((c) => c.id === conversationId);
      if (conv) {
        setTimeout(() => {
          this.messageHandler?.({
            id: `greeting-${conversationId}-${Date.now()}`,
            type: "text",
            from: "bot",
            data: {
              text: `You are now talking with **${conv.contact ?? conv.title}**. How can I help?`,
            },
            timestamp: Date.now(),
          });
        }, 200);
      }
    }
  }

  async closeConversation(conversationId: string): Promise<void> {
    const conv = this._conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.status = "closed";
      this.conversationHandler?.(conv);
    }
  }

  onConversationUpdate(callback: ConversationHandler): void {
    this.conversationHandler = callback;
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
