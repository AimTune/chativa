import useMessageStore from "./messageStore";
import { useMessageTypeRegistry } from "./messageRegistry";
import type { BaseMessage, ChatAdapter } from "./adapter";

export class ChatEngine {
  private adapter: ChatAdapter;
  constructor(adapter: ChatAdapter) {
    this.adapter = adapter;
  }

  init() {
    this.adapter.onMessage((msg: BaseMessage) => {
      const Component = useMessageTypeRegistry.resolve(msg.type);
      useMessageStore.getState().addMessage({ ...msg, component: Component });
    });
  }

  send(msg: BaseMessage) {
    // Kullanıcı mesajını hemen ekle
    const Component = useMessageTypeRegistry.resolve(msg.type);
    useMessageStore.getState().addMessage({ ...msg, component: Component });
    this.adapter.sendMessage(msg);
  }
}
