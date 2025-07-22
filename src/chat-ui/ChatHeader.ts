import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { t } from "i18next";
import { ChatbotMixin } from "../mixins/ChatbotMixin";

@customElement("chat-header")
class ChatHeader extends ChatbotMixin(LitElement) {
  render() {
    return html`<div class="chat-header">${t("title")}</div>`;
  }
}

export default ChatHeader;