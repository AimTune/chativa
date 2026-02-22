import { css, LitElement, unsafeCSS } from "lit";
import { state } from "lit/decorators.js";
import chatStore, { type ChatStoreState } from "../application/stores/ChatStore";
import type { ThemeConfig } from "../domain/value-objects/Theme";
import i18next from "../i18n/i18n";
import commonStyles from "../styles/commonStyles?inline" with { type: "css" };
import styless from "../styles.css?inline" with { type: "css" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = object> = new (...args: any[]) => T;
const styles = css`${unsafeCSS(styless)}`;

export declare class ChatbotMixinInterface {
  lang: string;
  theme: ThemeConfig;
  themeState: ChatStoreState;
}

export const ChatbotMixin = <T extends Constructor<LitElement>>(
  superClass: T
) => {
  class ChatbotMixinClass extends superClass {
    @state()
    private _lang = i18next.language;

    get lang() {
      return this._lang;
    }

    static styles = [styles, commonStyles];

    private _unsubscribeChatStore!: () => void;

    private _onLanguageChanged = () => {
      this._lang = i18next.language;
    };

    connectedCallback() {
      super.connectedCallback();
      this._unsubscribeChatStore = chatStore.subscribe(() =>
        this.requestUpdate()
      );
      i18next.on("languageChanged", this._onLanguageChanged);
    }

    disconnectedCallback() {
      this._unsubscribeChatStore?.();
      i18next.off("languageChanged", this._onLanguageChanged);
      super.disconnectedCallback();
    }

    get themeState(): ChatStoreState {
      return chatStore.getState();
    }

    get theme(): ThemeConfig {
      return chatStore.getState().theme;
    }
  }

  return ChatbotMixinClass as unknown as Constructor<ChatbotMixinInterface> & T;
};
