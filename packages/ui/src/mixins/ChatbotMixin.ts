import { css, LitElement, unsafeCSS } from "lit";
import { state } from "lit/decorators.js";
import { chatStore, type ChatStoreState, type ThemeConfig, I18nMixin, i18next } from "@chativa/core";
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
  // I18nMixin handles the languageChanged subscription and requestUpdate().
  class ChatbotMixinClass extends I18nMixin(superClass) {
    @state()
    private _lang = i18next.language;

    get lang() {
      return this._lang;
    }

    static styles = [styles, commonStyles];

    private _unsubscribeChatStore!: () => void;

    override connectedCallback() {
      super.connectedCallback();
      this._lang = i18next.language;
      this._unsubscribeChatStore = chatStore.subscribe(() =>
        this.requestUpdate()
      );
      // Keep _lang in sync when language changes (I18nMixin already calls requestUpdate).
      i18next.on("languageChanged", () => { this._lang = i18next.language; });
    }

    override disconnectedCallback() {
      this._unsubscribeChatStore?.();
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
