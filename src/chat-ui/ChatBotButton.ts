import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";
setBasePath("node_modules/@shoelace-style/shoelace/dist");

import "@shoelace-style/shoelace/dist/themes/light.css";
import { ChatbotMixin } from "../mixins/ChatbotMixin";
import i18next from "../i18n/i18n";

@customElement("chat-bot-button")
class ChatBotButton extends ChatbotMixin(LitElement) {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  #getButtonStyle(): string {
    const position = this.theme.position ?? "bottom-right";
    const margin = this.theme.positionMargin
      ? `${this.theme.positionMargin}em`
      : "1em";

    const styles: Partial<CSSStyleDeclaration> = {
      position: "fixed",
      cursor: "pointer",
    };

    position.split("-").forEach((pos) => {
      if (pos === "right" || pos === "left") styles[pos] = margin;
      else if (pos === "top" || pos === "bottom") styles[pos] = margin;
    });

    return Object.entries(styles)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
  }

  #changeLocation() {
    const position = this.theme.position ?? "bottom-right";
    i18next.changeLanguage(this.lang === "en" ? "tr" : "en");
    // setTheme now accepts DeepPartial — no need to spread the full theme
    this.themeState.setTheme({
      position: position === "bottom-right" ? "bottom-left" : "bottom-right",
    });
  }

  #openChatWidget() {
    this.themeState.toggle();
  }

  render() {
    const size = this.theme.size ?? "large";

    return html`
      <button @click=${this.#changeLocation}>${this.theme.position}</button>
      <sl-button
        variant="primary"
        size="${size}"
        circle
        style="${this.#getButtonStyle()}"
        @click=${this.#openChatWidget}
      >
        <sl-icon
          src="https://shoelace.style/assets/images/shoe.svg"
          style="font-size: 1.6em; vertical-align: -6px;"
        ></sl-icon>
      </sl-button>
    `;
  }
}

export default ChatBotButton;
