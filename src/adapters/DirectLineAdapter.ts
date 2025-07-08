import type { ChatAdapter, BaseMessage } from "../chat-core/adapter";
import { DirectLine } from "botframework-directlinejs";

function createUniqueId() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

async function generateNewToken(
  directLineKey: string
): Promise<{ token: string; userId: string; conversationId: string }> {
  const userId = createUniqueId();

  const res = await fetch(
    "https://directline.botframework.com/v3/directline/tokens/generate",
    {
      body: JSON.stringify({ user: { id: userId, name: userId } }),
      headers: {
        Authorization: `Bearer ${directLineKey}`,
        "Content-type": "application/json",
      },
      method: "POST",
    }
  );
  const { token, conversationId } = await res.json();

  return { token, userId, conversationId };
}

export class DirectLineAdapter implements ChatAdapter {
  private directLine!: DirectLine;
  private conversationId!: string;
  dontAddToHistory: boolean = true;

  private onMsg: ((msg: BaseMessage) => void) | null = null;

  //constructor(directLine: DirectLine) {
  constructor() {
    const that = this;
    generateNewToken("").then((res) => {
      that.directLine = new DirectLine({
        token: res.token,
      });
      that.conversationId = res.conversationId;

      that.directLine.activity$
        .filter((activity) => activity.type === "message")
        .subscribe((activity) => {
          if (that.onMsg) {
            that.onMsg({
              id: activity.id ?? "",
              type: activity.type,
              data: { text: activity.text ?? "" },
            });
          }
        });
    });
  }

  onMessage(callback: (msg: BaseMessage) => void): void {
    this.onMsg = callback;
  }
  sendMessage(message: BaseMessage): void {
    console.log("sendMessage çağrıldı:", message);
    this.directLine
      .postActivity({
        type: "message",
        from: { id: "user" },
        text: message.data.text,
        conversation: { id: this.conversationId },
        channelId: "directline",
        timestamp: new Date().toISOString(),
        id: message.id,
      })
      .subscribe();
  }
}
