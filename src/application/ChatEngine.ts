import type { IConnector } from "../domain/ports/IConnector";
import type { OutgoingMessage } from "../domain/entities/Message";
import { ExtensionRegistry } from "./registries/ExtensionRegistry";
import { MessageTypeRegistry } from "./registries/MessageTypeRegistry";
import messageStore from "./stores/MessageStore";

export class ChatEngine {
  private connector: IConnector;

  constructor(connector: IConnector) {
    this.connector = connector;
  }

  async init(): Promise<void> {
    this.connector.onMessage((msg) => {
      const transformed = ExtensionRegistry.runAfterReceive(msg);
      if (transformed === null) return; // extension blocked it

      const Component = MessageTypeRegistry.resolve(transformed.type);
      messageStore.getState().addMessage({ ...transformed, component: Component });
    });

    await this.connector.connect();
  }

  async send(message: OutgoingMessage): Promise<void> {
    const transformed = ExtensionRegistry.runBeforeSend(message);
    if (transformed === null) return; // extension blocked it

    if (this.connector.addSentToHistory !== false) {
      const Component = MessageTypeRegistry.resolve(transformed.type);
      messageStore.getState().addMessage({ ...transformed, component: Component });
    }

    await this.connector.sendMessage(transformed);
  }

  async destroy(): Promise<void> {
    await this.connector.disconnect();
  }
}
