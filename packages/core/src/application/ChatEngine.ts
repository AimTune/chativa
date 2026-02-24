import type { IConnector } from "../domain/ports/IConnector";
import type { OutgoingMessage } from "../domain/entities/Message";
import { ExtensionRegistry } from "./registries/ExtensionRegistry";
import { MessageTypeRegistry } from "./registries/MessageTypeRegistry";
import messageStore from "./stores/MessageStore";
import chatStore from "./stores/ChatStore";

export class ChatEngine {
  private connector: IConnector;

  constructor(connector: IConnector) {
    this.connector = connector;
  }

  async init(): Promise<void> {
    this.connector.onMessage((msg) => {
      chatStore.getState().setTyping(false);

      const transformed = ExtensionRegistry.runAfterReceive(msg);
      if (transformed === null) return; // extension blocked it

      const Component = MessageTypeRegistry.resolve(transformed.type);
      messageStore.getState().addMessage({ ...transformed, from: "bot", component: Component });
    });

    this.connector.onDisconnect?.(() => {
      chatStore.getState().setConnectorStatus("disconnected");
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
    await this.connector.disconnect();
    chatStore.getState().setConnectorStatus("disconnected");
  }
}
