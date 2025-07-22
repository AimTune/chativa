import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { property } from "lit/decorators.js";
import { ChatbotMixin } from "../mixins/ChatbotMixin";

@customElement("chat-input")
class ChatInput extends ChatbotMixin(LitElement) {
  @property({ type: String }) value = "";

  private onInput(e: Event) {
    this.value = (e.target as HTMLInputElement).value;
  }

  private onSend(e: Event) {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent("send-message", {
        detail: this.value,
        bubbles: true,
        composed: true,
      })
    );
    this.value = "";
  }

  render() {
    return html`
      <form @submit=${this.onSend.bind(this)}>
        <div class="flex items-center gap-2">
          <input
            type="text"
            id="chat-input"
            .value=${this.value}
            @input=${this.onInput}
            placeholder="Mesaj yaz..."
            class="flex-1 min-w-0"
          />
          <button type="button" class="emoji-btn">😊</button>
          <button type="submit" class="send-btn">Gönder</button>
        </div>
      </form>
    `;
  }
}

export default ChatInput;