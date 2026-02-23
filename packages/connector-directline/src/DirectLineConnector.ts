import type { IConnector, MessageHandler } from "@chativa/core";
import type { OutgoingMessage } from "@chativa/core";
import { DirectLine } from "botframework-directlinejs";

export interface DirectLineConnectorOptions {
  secret?: string;
  token?: string;
  tokenGeneratorUrl?: string;
}

function createUserId(): string {
  return (
    Math.random().toString(36).slice(2, 15) +
    Math.random().toString(36).slice(2, 15)
  );
}

async function fetchToken(
  secret: string
): Promise<{ token: string; conversationId: string; userId: string }> {
  const userId = createUserId();
  const res = await fetch(
    "https://directline.botframework.com/v3/directline/tokens/generate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user: { id: userId, name: userId } }),
    }
  );
  if (!res.ok) {
    throw new Error(`DirectLine token fetch failed: ${res.status}`);
  }
  const { token, conversationId } = (await res.json()) as {
    token: string;
    conversationId: string;
  };
  return { token, conversationId, userId };
}

/**
 * DirectLineConnector — Azure Bot Framework DirectLine v3 adapter.
 *
 * The bot echoes messages back, so we set addSentToHistory = false
 * to prevent user messages appearing twice.
 */
export class DirectLineConnector implements IConnector {
  readonly name = "directline";
  readonly addSentToHistory = false;

  private directLine!: DirectLine;
  private conversationId!: string;
  private userId!: string;
  private messageHandler: MessageHandler | null = null;
  private options: DirectLineConnectorOptions;

  constructor(options: DirectLineConnectorOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    let token: string;

    if (this.options.token) {
      token = this.options.token;
      this.userId = createUserId();
    } else if (this.options.secret) {
      const result = await fetchToken(this.options.secret);
      token = result.token;
      this.conversationId = result.conversationId;
      this.userId = result.userId;
    } else {
      throw new Error("DirectLineConnector: provide either token or secret.");
    }

    this.directLine = new DirectLine({ token });

    this.directLine.activity$
      .filter((a) => a.type === "message")
      .subscribe((activity) => {
        this.messageHandler?.({
          id: activity.id ?? `dl-${Date.now()}`,
          type: "text",
          data: { text: activity.text ?? "" },
          timestamp: Date.now(),
        });
      });
  }

  async disconnect(): Promise<void> {
    // DirectLine SDK doesn't expose an explicit close method
    this.messageHandler = null;
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    this.directLine
      .postActivity({
        type: "message",
        from: { id: this.userId },
        text: (message.data as { text?: string }).text ?? "",
        conversation: { id: this.conversationId },
        channelId: "directline",
        timestamp: new Date().toISOString(),
        id: message.id,
      })
      .subscribe();
  }

  onMessage(callback: MessageHandler): void {
    this.messageHandler = callback;
  }
}
