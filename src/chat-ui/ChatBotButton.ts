// I want to create a chatbot button please complete
// the code below to create a chatbot button that opens a chat widget when clicked.
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import useChatBotStore from "../chat-core/chatbotStore";
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
setBasePath('node_modules/@shoelace-style/shoelace/dist');

import '@shoelace-style/shoelace/dist/themes/light.css';

@customElement("chat-bot-button")
class ChatBotButton extends LitElement {
    private unsubscribeChatBot!: () => void;

    connectedCallback() {
        super.connectedCallback();
        this.unsubscribeChatBot = useChatBotStore.subscribe(() => this.requestUpdate());
    }

    disconnectedCallback() {
        this.unsubscribeChatBot?.();
        super.disconnectedCallback();
    }

    static styles = css`
        .chat-bot-button {
            position: fixed;
            cursor: pointer;
            padding: 8px;
        }
    `;


    #getButtonStyle() {
        const theme = useChatBotStore.getState().getTheme();

        // Defaults
        const position = theme.position || 'bottom-right';
        const styles: Partial<CSSStyleDeclaration> = {
            position: 'fixed',
            cursor: 'pointer',
        };

        position.split('-').forEach((pos) => {
            if (['right', 'left'].includes(pos)) {
                styles[pos as 'right' | 'left'] = theme.positionMargin ? `${theme.positionMargin}em` : "1em";
            } else if (['top', 'bottom'].includes(pos)) {
                styles[pos as 'top' | 'bottom'] = theme.positionMargin ? `${theme.positionMargin}em` : "1em";
            }
        });

        return Object.entries(styles)
            .map(([key, value]) => `${key}: ${value}`)
            .join('; ');
    }

    #changeLocation() {
        const theme = useChatBotStore.getState().getTheme();
        const position = theme.position || 'bottom-right';

        useChatBotStore.getState().setTheme({
            ...theme,
            position: position === 'bottom-right' ? 'bottom-left' : 'bottom-right',
        });

    }

    render() {
        const theme = useChatBotStore.getState().getTheme();
        const size = theme.size || 'large';

        return html`
        <button @click=${this.#changeLocation}>${theme.position}</button>
        <sl-button
          variant="primary"
          size="${size}"
          class ="right-1"
          circle
          style="${this.#getButtonStyle()}"
          @click=${this.#openChatWidget}>
            <sl-icon src="https://shoelace.style/assets/images/shoe.svg" style="font-size: 1.6em; vertical-align: -6px;"></sl-icon>
        </sl-button>
    `;
    }

    #openChatWidget() {
        useChatBotStore.getState().toggle();
    }
}

export default ChatBotButton;