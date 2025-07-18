import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import useMessageStore from "../chat-core/messageStore";
import useChatBotStore from "../chat-core/chatbotStore";
import { ChatEngine } from "../chat-core/ChatEngine";
import { useAdapterRegistry } from "../chat-core/adapter";
import { useMessageTypeRegistry } from "../chat-core/messageRegistry";
import { DefaultTextMessage } from "./DefaultTextMessage";
import "./ChatInput";
import "./ChatMessageList";
import "./ChatHeader";
import { DirectLineAdapter } from "../adapters/DirectLineAdapter";
import 'primeflex/primeflex.css';

//import { DummyAdapter } from "../adapters/DummyAdapter";

const directLine = new DirectLineAdapter();
//const dummy = new DummyAdapter();
//useAdapterRegistry.register("default", dummy);
useAdapterRegistry.register("default", directLine);
useMessageTypeRegistry.register("text", DefaultTextMessage);

@customElement("chat-iva")
export class ChatWidget extends LitElement {
  private unsubscribeMessages!: () => void;
  private unsubscribeChatBot!: () => void;
  private engine!: ChatEngine;

  @property({ type: String }) adapterName = "default";

  connectedCallback() {
    super.connectedCallback();
    const adapter = useAdapterRegistry.get(this.adapterName);
    if (!adapter) throw new Error(`Adapter ${this.adapterName} not found`);
    this.engine = new ChatEngine(adapter);
    this.engine.init();
    this.unsubscribeMessages = useMessageStore.subscribe(() =>
      this.requestUpdate()
    );
    this.unsubscribeChatBot = useChatBotStore.subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    this.unsubscribeMessages?.();
    this.unsubscribeChatBot?.();
    super.disconnectedCallback();
  }

  private handleSendMessage(e: CustomEvent) {
    const text = e.detail;
    console.log("handleSendMessage çağrıldı:", text);
    if (text && text.trim()) {
      this.engine.send({
        id: Date.now().toString(),
        type: "text",
        data: { text },
      });
    }
  }

  render() {
    const chatBotState = useChatBotStore.getState();
    const theme = chatBotState.getTheme();
    return chatBotState.isOpened ? html`
      <div
        part="container"
        style=${Object.entries(theme)
        .map(([k, v]) => `${k}: ${v};`)
        .join(" ")}
      >
        <chat-header></chat-header>
        <chat-message-list></chat-message-list>
        <chat-input
          @send-message=${this.handleSendMessage.bind(this)}
        ></chat-input>
      </div>
    ` : nothing;
  }
}

export default ChatWidget;