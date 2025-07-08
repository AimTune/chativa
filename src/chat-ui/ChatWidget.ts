import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import useMessageStore from "../chat-core/messageStore";
import useThemeStore from "../chat-core/themeStore";
import { ChatEngine } from "../chat-core/ChatEngine";
import { useAdapterRegistry } from "../chat-core/adapter";
import { useMessageTypeRegistry } from "../chat-core/messageRegistry";
import { DefaultTextMessage } from "./DefaultTextMessage";
import "./ChatInput";
import "./ChatMessageList";
import "./ChatHeader";
import { DirectLineAdapter } from "../adapters/DirectLineAdapter";
//import { DummyAdapter } from "../adapters/DummyAdapter";

const directLine = new DirectLineAdapter();
//const dummy = new DummyAdapter();
//useAdapterRegistry.register("default", dummy);
useAdapterRegistry.register("default", directLine);
useMessageTypeRegistry.register("text", DefaultTextMessage);

@customElement("chat-iva")
export class ChatWidget extends LitElement {
  private unsubscribeMessages!: () => void;
  private unsubscribeTheme!: () => void;
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
    this.unsubscribeTheme = useThemeStore.subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    this.unsubscribeMessages?.();
    this.unsubscribeTheme?.();
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
    const theme = useThemeStore.getState().getTheme();
    return html`
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
    `;
  }
}
