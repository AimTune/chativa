import type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
  TypingHandler,
} from "@chativa/core";
import type { OutgoingMessage } from "@chativa/core";
import { DirectLine, ConnectionStatus } from "botframework-directlinejs";
import { mapActivityToMessage, TYPING_SENTINEL } from "./mapActivity";

/** Minimal subscription interface returned by RxJS5 Observable.subscribe(). */
interface Unsubscribable {
  unsubscribe(): void;
}

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
}

function createUserId(): string {
  return (
    Math.random().toString(36).slice(2, 15) +
    Math.random().toString(36).slice(2, 15)
  );
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

  private messageHandler: MessageHandler | null = null;
  private connectHandler: ConnectHandler | null = null;
  private disconnectHandler: DisconnectHandler | null = null;
  private typingHandler: TypingHandler | null = null;

  private activitySub: Unsubscribable | null = null;
  private connectionSub: Unsubscribable | null = null;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: DirectLineConnectorOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    this.userId = this.options.userId ?? createUserId();
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

    // Subscribe to connection status
    this.connectionSub = this.directLine.connectionStatus$.subscribe(
      (status: ConnectionStatus) => {
        switch (status) {
          case ConnectionStatus.Online:
            this.connectHandler?.();
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
        const result = mapActivityToMessage(activity, this.userId);

        if (result === TYPING_SENTINEL) {
          this.handleTyping();
          return;
        }

        if (result !== null) {
          // Clear typing indicator when a message arrives
          this.clearTypingTimeout();
          this.typingHandler?.(false);
          this.messageHandler?.(result);
        }
      } catch (err) {
        console.warn("[DirectLineConnector] Activity mapping error:", err);
      }
    });
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
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.directLine
        .postActivity({
          type: "message",
          from: { id: this.userId, name: this.userName ?? this.userId },
          text: (message.data as { text?: string }).text ?? "",
          conversation: { id: this.conversationId },
          channelId: "directline",
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

  /* ── Private helpers ───────────────────────────────────────────── */

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
