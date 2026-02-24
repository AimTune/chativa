import type { IConnector, FeedbackType } from "../domain/ports/IConnector";
import type { OutgoingMessage } from "../domain/entities/Message";
import { ExtensionRegistry } from "./registries/ExtensionRegistry";
import { MessageTypeRegistry } from "./registries/MessageTypeRegistry";
import messageStore from "./stores/MessageStore";
import chatStore from "./stores/ChatStore";

export class ChatEngine {
  private connector: IConnector;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _destroyed = false;

  constructor(connector: IConnector) {
    this.connector = connector;
  }

  async init(): Promise<void> {
    this._destroyed = false;

    this.connector.onMessage((msg) => {
      chatStore.getState().setTyping(false);

      const transformed = ExtensionRegistry.runAfterReceive(msg);
      if (transformed === null) return; // extension blocked it

      // Increment unread count when chat is closed
      if (!chatStore.getState().isOpened) {
        chatStore.getState().incrementUnread();
      }

      const Component = MessageTypeRegistry.resolve(transformed.type);
      messageStore.getState().addMessage({ ...transformed, from: "bot", component: Component });
    });

    this.connector.onDisconnect?.((reason) => {
      chatStore.getState().setConnectorStatus("disconnected");
      // Auto-reconnect unless destroyed or user-initiated disconnect
      if (!this._destroyed && reason !== "user") {
        this._scheduleReconnect(1);
      }
    });

    this.connector.onTyping?.((isTyping) => {
      chatStore.getState().setTyping(isTyping);
    });

    chatStore.getState().setConnectorStatus("connecting");
    try {
      await this.connector.connect();
      chatStore.getState().setConnectorStatus("connected");
    } catch (err) {
      chatStore.getState().setConnectorStatus("error");
      throw err;
    }
  }

  private _scheduleReconnect(attempt: number): void {
    if (this._destroyed || attempt > 3) {
      chatStore.getState().setConnectorStatus("error");
      chatStore.getState().setReconnectAttempt(0);
      return;
    }

    chatStore.getState().setReconnectAttempt(attempt);
    chatStore.getState().setConnectorStatus("connecting");

    const delay = 2000 * attempt; // 2s, 4s, 6s
    this._reconnectTimer = setTimeout(async () => {
      if (this._destroyed) return;
      try {
        await this.connector.connect();
        chatStore.getState().setConnectorStatus("connected");
        chatStore.getState().setReconnectAttempt(0);
      } catch {
        this._scheduleReconnect(attempt + 1);
      }
    }, delay);
  }

  async sendFeedback(messageId: string, feedback: FeedbackType): Promise<void> {
    await this.connector.sendFeedback?.(messageId, feedback);
  }

  async send(message: OutgoingMessage): Promise<void> {
    const transformed = ExtensionRegistry.runBeforeSend(message);
    if (transformed === null) return; // extension blocked it

    if (this.connector.addSentToHistory !== false) {
      const Component = MessageTypeRegistry.resolve(transformed.type);
      messageStore.getState().addMessage({ ...transformed, from: "user", component: Component });
    }

    await this.connector.sendMessage(transformed);
  }

  async destroy(): Promise<void> {
    this._destroyed = true;
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    chatStore.getState().setReconnectAttempt(0);
    await this.connector.disconnect();
    chatStore.getState().setConnectorStatus("disconnected");
  }
}
