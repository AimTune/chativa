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
      this._applyThemeVars();
      this._unsubscribeChatStore = chatStore.subscribe(() => {
        this._applyThemeVars();
        this.requestUpdate();
      });
      // Keep _lang in sync when language changes (I18nMixin already calls requestUpdate).
      i18next.on("languageChanged", () => { this._lang = i18next.language; });
    }

    /** Push ThemeConfig colors onto the host element as CSS custom properties
     *  so that all `var(--chativa-*)` references inside shadow DOM pick them up. */
    private _applyThemeVars() {
      const { colors } = chatStore.getState().theme;
      this.style.setProperty("--chativa-primary-color", colors.primary);
      this.style.setProperty("--chativa-primary-dark", colors.secondary);
      this.style.setProperty("--chativa-secondary-color", colors.secondary);
      this.style.setProperty("--chativa-background", colors.background);
      this.style.setProperty("--chativa-text", colors.text);
      this.style.setProperty("--chativa-border", colors.border);
      if (colors.accent) this.style.setProperty("--chativa-accent-color", colors.accent);
      if (colors.surface) this.style.setProperty("--chativa-surface", colors.surface);
      if (colors.textSecondary) this.style.setProperty("--chativa-text-secondary", colors.textSecondary);
      if (colors.textTertiary) {
        this.style.setProperty("--chativa-text-tertiary", colors.textTertiary);
        this.style.setProperty("--chativa-text-muted", colors.textTertiary);
      }
      if (colors.success) this.style.setProperty("--chativa-success-color", colors.success);
      if (colors.error) this.style.setProperty("--chativa-error-color", colors.error);
      if (colors.warning) this.style.setProperty("--chativa-warning-color", colors.warning);
      if (colors.info) this.style.setProperty("--chativa-info-color", colors.info);
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
