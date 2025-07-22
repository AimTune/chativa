import { LitElement } from "lit";
import useChatBotStore, { type IThemeSettings } from "../chat-core/chatbotStore";
import { state } from "lit/decorators.js";
import i18next from "../i18n/i18n";

type Constructor<T = {}> = new (...args: any[]) => T;

export declare class ChatbotMixinInterface {
  unsubscribeChatBot: () => void;
  lang: string;
  theme: IThemeSettings;
  themeState: ReturnType<typeof useChatBotStore.getState>;
}

export const ChatbotMixin = <T extends Constructor<LitElement>>(
  superClass: T
) => {
  class ChatbotMixin extends superClass {
    @state()
    private _lang = i18next.language;

    get lang() {
      return this._lang;
    }

    private unsubscribeChatBot!: () => void;

    private i18nLanguageChangeListener() {
      this._lang = i18next.language;
    }

    connectedCallback() {
      super.connectedCallback();

      this.unsubscribeChatBot = useChatBotStore.subscribe(() => this.requestUpdate());

      i18next.on('languageChanged', this.i18nLanguageChangeListener.bind(this));
    }

    disconnectedCallback() {
      this.unsubscribeChatBot?.();

      i18next.off('languageChanged', this.i18nLanguageChangeListener.bind(this));

      super.disconnectedCallback();
    }

    get themeState() {
      return useChatBotStore.getState();
    }

    get theme() {
      return this.themeState.getTheme();
    }
  }

  return ChatbotMixin as unknown as Constructor<ChatbotMixinInterface> & T;
};
