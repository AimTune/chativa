import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChatEngine } from "../application/ChatEngine";
import { ConnectorRegistry } from "../application/registries/ConnectorRegistry";
import { MessageTypeRegistry } from "../application/registries/MessageTypeRegistry";
import messageStore from "../application/stores/MessageStore";
import { createOutgoingMessage } from "../domain/entities/Message";
import { DummyConnector } from "../infrastructure/connectors/DummyConnector";
import { ChatbotMixin } from "../mixins/ChatbotMixin";

// Register the fallback message component
import "./DefaultTextMessage";
import "./ChatInput";
import "./ChatMessageList";
import "./ChatHeader";

// Register the default connector once
if (!ConnectorRegistry.has("dummy")) {
  ConnectorRegistry.register(new DummyConnector());
}
// Set DefaultTextMessage as fallback for unknown message types
MessageTypeRegistry.setFallback(
  customElements.get("default-text-message") as unknown as typeof HTMLElement
);

@customElement("chat-iva")
export class ChatWidget extends ChatbotMixin(LitElement) {
  private _unsubscribeMessages!: () => void;
  private _engine!: ChatEngine;

  /** Name of the registered connector to use. Defaults to "dummy". */
  @property({ type: String }) connector = "dummy";

  connectedCallback() {
    super.connectedCallback();

    const adapter = ConnectorRegistry.get(this.connector);
    this._engine = new ChatEngine(adapter);
    this._engine.init().catch((err: unknown) => {
      console.error("[ChatWidget] Engine init failed:", err);
    });

    this._unsubscribeMessages = messageStore.subscribe(() =>
      this.requestUpdate()
    );
  }

  disconnectedCallback() {
    this._unsubscribeMessages?.();
    this._engine?.destroy().catch(() => {});
    super.disconnectedCallback();
  }

  private handleSendMessage(e: CustomEvent<string>) {
    const text = e.detail?.trim();
    if (!text) return;
    this._engine
      .send(createOutgoingMessage(text))
      .catch((err: unknown) => console.error("[ChatWidget] Send failed:", err));
  }

  private get _isAlignedRight() {
    const p = this.theme.position;
    return p === "bottom-right" || p === "top-right";
  }

  private get _isAlignedBottom() {
    const p = this.theme.position;
    return p === "bottom-right" || p === "bottom-left";
  }

  private get _containerClasses() {
    const { layout } = this.theme;
    const vSpace = layout?.verticalSpace ?? "2";
    const hSpace = layout?.horizontalSpace ?? "2";
    return (
      "absolute " +
      `${this._isAlignedBottom ? `b-${vSpace}` : `t-${vSpace}`} ` +
      `${this._isAlignedRight ? `r-${hSpace}` : `l-${hSpace}`} ` +
      `w-${layout?.width ?? "18rem"} h-${layout?.height ?? "25rem"}`
    );
  }

  render() {
    if (!this.themeState.isOpened) return nothing;

    const bgColor = this.theme.colors.secondary ?? "#000";
    const side = this._isAlignedRight ? "right" : "left";

    return html`
      <div
        .style="${side}: 70px; background-color: ${bgColor};"
        class="${this._containerClasses}"
      >
        <chat-header></chat-header>
        <chat-message-list></chat-message-list>
        <chat-input
          @send-message=${this.handleSendMessage.bind(this)}
          class="absolute bottom-0 w-full p-1"
        ></chat-input>
      </div>
    `;
  }
}

export default ChatWidget;
