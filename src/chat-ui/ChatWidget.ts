import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import useMessageStore from "../chat-core/messageStore";
import { ChatEngine } from "../chat-core/ChatEngine";
import { useAdapterRegistry } from "../chat-core/adapter";
import { useMessageTypeRegistry } from "../chat-core/messageRegistry";
import { DefaultTextMessage } from "./DefaultTextMessage";
import "./ChatInput";
import "./ChatMessageList";
import "./ChatHeader";
import { DirectLineAdapter } from "../adapters/DirectLineAdapter";
import { ChatbotMixin } from "../mixins/ChatbotMixin";

//import { DummyAdapter } from "../adapters/DummyAdapter";

const directLine = new DirectLineAdapter();
//const dummy = new DummyAdapter();
//useAdapterRegistry.register("default", dummy);
useAdapterRegistry.register("default", directLine);
useMessageTypeRegistry.register("text", DefaultTextMessage);


@customElement("chat-iva")
export class ChatWidget extends ChatbotMixin(LitElement) {
  private unsubscribeMessages!: () => void;
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
  }

  disconnectedCallback() {
    this.unsubscribeMessages?.();
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
    return this.themeState.isOpened ? html`
      <div
        .style="
          bottom: 0; ${["bottom-right", "top-right"].includes(this.theme.position!) ? 'right' : 'left'}: 70px;
          background-color: ${this.theme.secondaryColor || "#000"};
        "
        class="absolute bottom-1 w-${this.theme.layout?.width || '18rem'} h-${this.theme.layout?.height || '25rem'}"
      >
        <chat-header></chat-header>
        <chat-message-list></chat-message-list>
        <chat-input
          @send-message=${this.handleSendMessage.bind(this)}
          class="absolute bottom-0 w-full p-1"
        ></chat-input>
      </div>
    ` : nothing;
  }
}

export default ChatWidget;