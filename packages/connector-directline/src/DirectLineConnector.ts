import type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
  TypingHandler,
  MessageStatusHandler,
  ChativaContext,
} from "@chativa/core";
import type { OutgoingMessage } from "@chativa/core";
import { DirectLine, ConnectionStatus } from "botframework-directlinejs";
import type { Activity } from "botframework-directlinejs";
import { mapActivityToMessage, TYPING_SENTINEL } from "./mapActivity";

/** Minimal subscription interface returned by RxJS5 Observable.subscribe(). */
interface Unsubscribable {
  unsubscribe(): void;
}

/**
 * Context passed to custom event handlers — provides the info and methods
 * needed to respond to a bot-initiated event activity.
 */
export interface EventHandlerContext {
  /** The raw DirectLine event activity. */
  activity: Activity;
  /** The user ID for this session. */
  userId: string;
  /** The user display name for this session. */
  userName: string;
  /** Send an event activity back to the bot. */
  postEvent(name: string, value?: unknown): void;
  /**
   * Full Chativa context — access messages, chat UI, theme, and event bus.
   * Available when the connector is used via ChatEngine (which injects it).
   */
  chativa: ChativaContext;
}

/**
 * Handler for a bot-initiated event activity.
 * Keyed by event name (e.g. `"LocationRequest"`).
 */
export type EventHandler = (ctx: EventHandlerContext) => void;

export interface DirectLineConnectorOptions {
  /** DirectLine channel secret (server-side only — generates a token). */
  secret?: string;
  /** Pre-fetched DirectLine token. */
  token?: string;
  /** URL of a custom token-generating endpoint (POST, returns { token, conversationId? }). */
  tokenGeneratorUrl?: string;
  /** Override the user ID instead of auto-generating one. */
  userId?: string;
  /** Display name sent with activities. */
  userName?: string;
  /** Sovereign-cloud DirectLine endpoint (e.g. government, china). */
  domain?: string;
  /** BCP-47 locale sent with the webchat/join event and outgoing activities (e.g. "tr-TR"). */
  locale?: string;
  /**
   * Extra key-value pairs merged into the `webchat/join` event's `value` payload.
   * Example: `{ language: "tr", tenant: "galataport" }`
   */
  joinParameters?: Record<string, unknown>;
  /**
   * Custom handlers for bot-initiated event activities, keyed by event name.
   * Example:
   * ```ts
   * eventHandlers: {
   *   LocationRequest: (ctx) => {
   *     navigator.geolocation.getCurrentPosition((pos) => {
   *       ctx.postEvent("webchat/location", {
   *         latitude: pos.coords.latitude,
   *         longitude: pos.coords.longitude,
   *       });
   *     });
   *   },
   * }
   * ```
   */
  eventHandlers?: Record<string, EventHandler>;
}

const USER_ID_KEY = "chativa_directline_userId";

function getOrCreateUserId(): string {
  try {
    const stored = localStorage.getItem(USER_ID_KEY);
    if (stored) return stored;
  } catch {
    // localStorage unavailable (e.g. incognito, SSR)
  }
  const id =
    Math.random().toString(36).slice(2, 15) +
    Math.random().toString(36).slice(2, 15);
  try {
    localStorage.setItem(USER_ID_KEY, id);
  } catch {
    // best-effort
  }
  return id;
}

async function fetchToken(
  secret: string,
  userId: string,
): Promise<{ token: string; conversationId: string }> {
  const res = await fetch(
    "https://directline.botframework.com/v3/directline/tokens/generate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user: { id: userId, name: userId } }),
    },
  );
  if (!res.ok) {
    throw new Error(`DirectLine token fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    token: string;
    conversationId: string;
  };
  return { token: data.token, conversationId: data.conversationId };
}

async function fetchTokenFromUrl(
  url: string,
): Promise<{ token: string; conversationId?: string; userId?: string }> {
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Token generator failed: ${res.status}`);
  }
  return (await res.json()) as {
    token: string;
    conversationId?: string;
    userId?: string;
  };
}

/**
 * DirectLineConnector — Azure Bot Framework DirectLine v3 adapter.
 *
 * Maps all Bot Framework activity types (hero cards, carousels,
 * suggested actions, images, videos, files, adaptive cards, etc.)
 * into Chativa's native message types.
 */
export class DirectLineConnector implements IConnector {
  readonly name = "directline";
  readonly addSentToHistory = true;

  private directLine!: DirectLine;
  private conversationId!: string;
  private userId!: string;
  private userName: string | undefined;
  private token!: string;
  private options: DirectLineConnectorOptions;
  private chativaCtx: ChativaContext | null = null;

  private messageHandler: MessageHandler | null = null;
  private connectHandler: ConnectHandler | null = null;
  private disconnectHandler: DisconnectHandler | null = null;
  private typingHandler: TypingHandler | null = null;
  private messageStatusHandler: MessageStatusHandler | null = null;

  private activitySub: Unsubscribable | null = null;
  private connectionSub: Unsubscribable | null = null;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Queue of sent message IDs awaiting echo confirmation. */
  private pendingIds: string[] = [];
  /** True after the first successful connection (used for join vs rejoin). */
  private hasConnectedBefore = false;
  /** Resolves the connect() promise once the bot sends its first message after join. */
  private resolveReady: (() => void) | null = null;

  constructor(options: DirectLineConnectorOptions) {
    this.options = options;
  }

  setContext(ctx: ChativaContext): void {
    this.chativaCtx = ctx;
  }

  /**
   * Register (or replace) an event handler for a bot-initiated event activity.
   * Can be called before or after `connect()`.
   *
   * @example
   * ```ts
   * connector.addEventHandler("LocationRequest", (ctx) => {
   *   navigator.geolocation.getCurrentPosition((pos) => {
   *     ctx.postEvent("webchat/location", { latitude: pos.coords.latitude, ... });
   *   });
   * });
   * ```
   */
  addEventHandler(name: string, handler: EventHandler): void {
    this.options.eventHandlers ??= {};
    this.options.eventHandlers[name] = handler;
  }

  /** Remove a previously registered event handler by name. */
  removeEventHandler(name: string): boolean {
    if (!this.options.eventHandlers?.[name]) return false;
    delete this.options.eventHandlers[name];
    return true;
  }

  /** Check whether an event handler is registered for the given name. */
  hasEventHandler(name: string): boolean {
    return !!this.options.eventHandlers?.[name];
  }

  /** Return the names of all registered event handlers. */
  getEventHandlerNames(): string[] {
    return Object.keys(this.options.eventHandlers ?? {});
  }

  async connect(): Promise<void> {
    this.userId = this.options.userId ?? getOrCreateUserId();
    this.userName = this.options.userName;

    // Acquire token
    if (this.options.tokenGeneratorUrl) {
      const result = await fetchTokenFromUrl(this.options.tokenGeneratorUrl);
      this.token = result.token;
      if (result.conversationId) this.conversationId = result.conversationId;
      if (result.userId) this.userId = result.userId;
    } else if (this.options.token) {
      this.token = this.options.token;
    } else if (this.options.secret) {
      const result = await fetchToken(this.options.secret, this.userId);
      this.token = result.token;
      this.conversationId = result.conversationId;
    } else {
      throw new Error(
        "DirectLineConnector: provide token, secret, or tokenGeneratorUrl.",
      );
    }

    this.directLine = new DirectLine({
      token: this.token,
      domain: this.options.domain,
    });

    // Promise that resolves when the bot sends its first message (after join event)
    const ready = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });

    // Subscribe to connection status
    this.connectionSub = this.directLine.connectionStatus$.subscribe(
      (status: ConnectionStatus) => {
        switch (status) {
          case ConnectionStatus.Online:
            this.sendJoinEvent();
            break;
          case ConnectionStatus.FailedToConnect:
            this.disconnectHandler?.("Failed to connect");
            break;
          case ConnectionStatus.Ended:
            this.disconnectHandler?.("Connection ended");
            break;
        }
      },
    );

    // Subscribe to activities
    this.activitySub = this.directLine.activity$.subscribe((activity) => {
      try {
        // Skip own echoed activities
        if (activity.from.id === this.userId) {
          // Echoed user message → mark the original as "read"
          if (activity.type === "message") {
            const pendingId = this.pendingIds.shift();
            if (pendingId) {
              this.messageStatusHandler?.(pendingId, "read");
            }
          }
          return;
        }

        // Bot-initiated event
        if (activity.type === "event" && activity.name) {
          // Built-in: DisableFeedbackButton — mark the message as feedback-sent
          if (activity.name === "DisableFeedbackButton" && activity.value) {
            const val = activity.value as { CorrelationId?: string; FeedbackType?: number };
            if (val.CorrelationId) {
              this.handleDisableFeedback(val.CorrelationId, val.FeedbackType);
            }
          }

          // Dispatch to custom event handler (if registered)
          const handler = this.options.eventHandlers?.[activity.name];
          if (handler) {
            handler(this.createEventContext(activity));
          }
          return;
        }

        const result = mapActivityToMessage(activity, this.userId);

        if (result === TYPING_SENTINEL) {
          this.handleTyping();
          return;
        }

        if (result !== null) {
          // Clear typing indicator when a message arrives
          this.clearTypingTimeout();
          this.typingHandler?.(false);

          // First bot message → resolve connect() and signal "connected"
          if (this.resolveReady) {
            this.resolveReady();
            this.resolveReady = null;
          }

          this.messageHandler?.(result);
        }
      } catch (err) {
        console.warn("[DirectLineConnector] Activity mapping error:", err);
      }
    });

    // Wait until the bot responds to the join event
    await ready;
    this.connectHandler?.();
  }

  async disconnect(): Promise<void> {
    this.activitySub?.unsubscribe();
    this.activitySub = null;
    this.connectionSub?.unsubscribe();
    this.connectionSub = null;
    this.clearTypingTimeout();

    try {
      this.directLine?.end();
    } catch {
      // DirectLine.end() may throw if already ended
    }

    this.messageHandler = null;
    this.connectHandler = null;
    this.disconnectHandler = null;
    this.typingHandler = null;
    this.messageStatusHandler = null;
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    this.pendingIds.push(message.id);
    // Mark as "sent" immediately so it shows before the echo arrives
    this.messageStatusHandler?.(message.id, "sent");
    return new Promise<void>((resolve, reject) => {
      this.directLine
        .postActivity({
          type: "message",
          from: { id: this.userId, name: this.userName ?? this.userId },
          text: (message.data as { text?: string }).text ?? "",
          conversation: { id: this.conversationId },
          channelId: "directline",
          ...(this.options.locale ? { locale: this.options.locale } : {}),
          timestamp: new Date().toISOString(),
          id: message.id,
        })
        .subscribe({
          next: () => resolve(),
          error: (err: unknown) => reject(err),
        });
    });
  }

  async sendFile(file: File): Promise<void> {
    const domain =
      this.options.domain ??
      "https://directline.botframework.com/v3/directline";
    const url = `${domain}/conversations/${this.conversationId}/upload?userId=${encodeURIComponent(this.userId)}`;

    const formData = new FormData();
    formData.append("file", file, file.name);

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`DirectLine file upload failed: ${res.status}`);
    }
  }

  async sendFeedback(messageId: string, feedback: "like" | "dislike"): Promise<void> {
    // Look up the correlationId from the stored message's channelData
    const msg = this.chativaCtx?.messages.getAll().find((m) => m.id === messageId);
    const correlationId =
      (msg?.data?.channelData as Record<string, unknown> | undefined)?.correlationId;

    if (!correlationId) {
      console.warn("[DirectLineConnector] sendFeedback: no correlationId found for message", messageId);
      return;
    }

    // Bot expects numeric: 0 = like, 1 = dislike
    const feedbackType = feedback === "like" ? 0 : 1;

    return new Promise<void>((resolve, reject) => {
      this.directLine
        .postActivity({
          type: "event",
          name: "webchat/messageFeedback",
          from: { id: this.userId, name: this.userId },
          value: { correlationId, feedbackType },
        })
        .subscribe({
          next: () => resolve(),
          error: (err: unknown) => reject(err),
        });
    });
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

  onMessageStatus(callback: MessageStatusHandler): void {
    this.messageStatusHandler = callback;
  }

  /* ── Private helpers ───────────────────────────────────────────── */

  /** Build the context object passed to custom event handlers. */
  private createEventContext(activity: Activity): EventHandlerContext {
    const from = { id: this.userId, name: this.userName ?? this.userId };
    return {
      activity,
      userId: this.userId,
      userName: this.userName ?? this.userId,
      postEvent: (name: string, value?: unknown) => {
        this.directLine
          .postActivity({
            type: "event",
            name,
            from,
            ...(this.options.locale ? { locale: this.options.locale } : {}),
            value,
          })
          .subscribe();
      },
      chativa: this.chativaCtx!,
    };
  }

  /** Send webchat/join (first connect) or webchat/rejoin (reconnect) event. */
  private sendJoinEvent() {
    const isRejoin = this.hasConnectedBefore;
    this.hasConnectedBefore = true;

    const locale = this.options.locale;
    const from = { id: this.userId, name: this.userName ?? this.userId };

    if (isRejoin) {
      this.directLine
        .postActivity({
          type: "event",
          name: "webchat/rejoin",
          from,
          ...(locale ? { locale } : {}),
          value: { ...(locale ? { language: locale } : {}) },
        })
        .subscribe();
    } else {
      this.directLine
        .postActivity({
          type: "event",
          name: "webchat/join",
          from,
          ...(locale ? { locale } : {}),
          value: {
            ...(locale ? { language: locale } : {}),
            ...this.options.joinParameters,
          },
        })
        .subscribe();
    }
  }

  /** Handle DisableFeedbackButton event — find the message by correlationId and patch it. */
  private handleDisableFeedback(correlationId: string, feedbackType?: number) {
    const messages = this.chativaCtx?.messages.getAll();
    if (!messages) return;
    const msg = messages.find(
      (m) => (m.data?.channelData as Record<string, unknown> | undefined)?.correlationId === correlationId,
    );
    if (msg) {
      this.chativaCtx!.messages.update(msg.id, {
        data: { ...msg.data, feedbackDisabled: true, feedbackType },
      });
    }
  }

  private handleTyping() {
    this.clearTypingTimeout();
    this.typingHandler?.(true);
    // Auto-clear typing after 3 seconds (bot may not send a stop signal)
    this.typingTimeout = setTimeout(() => {
      this.typingHandler?.(false);
      this.typingTimeout = null;
    }, 3000);
  }

  private clearTypingTimeout() {
    if (this.typingTimeout !== null) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }
}
