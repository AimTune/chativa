import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { property } from "lit/decorators.js";

@customElement("chat-input")
class ChatInput extends LitElement {
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
      <form @submit=${this.onSend.bind(this)} class="chat-input-form">
        <input
          type="text"
          .value=${this.value}
          @input=${this.onInput}
          placeholder="Mesaj yaz..."
        />
        <button type="button" class="emoji-btn">😊</button>
        <button type="submit" class="send-btn">Gönder</button>
      </form>
    `;
  }
}
