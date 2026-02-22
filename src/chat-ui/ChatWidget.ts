import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChatEngine } from "../application/ChatEngine";
import { ConnectorRegistry } from "../application/registries/ConnectorRegistry";
import { MessageTypeRegistry } from "../application/registries/MessageTypeRegistry";
import messageStore from "../application/stores/MessageStore";
import { createOutgoingMessage } from "../domain/entities/Message";
import { DummyConnector } from "../infrastructure/connectors/DummyConnector";
import { ChatbotMixin } from "../mixins/ChatbotMixin";

import "./DefaultTextMessage";
import "./ChatInput";
import "./ChatMessageList";
import "./ChatHeader";

if (!ConnectorRegistry.has("dummy")) {
  ConnectorRegistry.register(new DummyConnector());
}
MessageTypeRegistry.setFallback(
  customElements.get("default-text-message") as unknown as typeof HTMLElement
);

@customElement("chat-iva")
export class ChatWidget extends ChatbotMixin(LitElement) {
  static override styles = css`
    :host {
      display: block;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(18px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .widget {
      position: fixed;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.14),
        0 6px 20px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      animation: slideUp 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
    }
  `;

  private _unsubscribeMessages!: () => void;
  private _engine!: ChatEngine;

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

  private get _position() {
    return this.theme.position ?? "bottom-right";
  }

  private get _positionStyle(): string {
    const { positionMargin, layout } = this.theme;
    const m = positionMargin ? `${Number(positionMargin) * 0.5 + 0.5}rem` : "1rem";
    // Place widget above the launcher button (56px + gap)
    const vOffset = `calc(${m} + 56px + 12px)`;
    const [v, h] = this._position.split("-");
    const w = layout?.width ?? "360px";
    const ht = layout?.height ?? "520px";
    return `${v}: ${vOffset}; ${h}: ${m}; width: ${w}; height: ${ht};`;
  }

  render() {
    if (!this.themeState.isOpened) return nothing;
    return html`
      <div class="widget" style="${this._positionStyle}">
        <chat-header></chat-header>
        <chat-message-list></chat-message-list>
        <chat-input
          @send-message=${this.handleSendMessage.bind(this)}
        ></chat-input>
      </div>
    `;
  }
}

export default ChatWidget;
