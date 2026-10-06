import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { chatStore, type ThemeConfig, type DeepPartial } from "@chativa/core";
import i18next from "i18next";
import { sectionStyles } from "../sandboxShared";

// Import i18next directly (the singleton) instead of from "@chativa/ui".
// The @chativa/ui index has side-effect imports that call
// customElements.define("chat-iva", ...). Pulling that into the static
// graph here would upgrade the existing <chat-iva> element before
// main.ts has registered the connector, causing
// `ConnectorRegistry: connector "dummy" not found` at boot.
// @chativa/ui's i18n.ts initializes the same i18next singleton at runtime.

// Languages bundled with @chativa/ui, labelled in their own language. Kept as a
// literal (not imported from @chativa/ui) for the same reason as i18next above.
const LANGUAGES: { label: string; value: string }[] = [
  { label: "English", value: "en" },
  { label: "Türkçe", value: "tr" },
  { label: "Español", value: "es" },
  { label: "Français", value: "fr" },
  { label: "Deutsch", value: "de" },
  { label: "Italiano", value: "it" },
  { label: "Português (Brasil)", value: "pt-BR" },
  { label: "Polski", value: "pl" },
  { label: "Nederlands", value: "nl" },
  { label: "Bahasa Indonesia", value: "id" },
  { label: "Tiếng Việt", value: "vi" },
  { label: "Русский", value: "ru" },
  { label: "Українська", value: "uk" },
  { label: "日本語", value: "ja" },
  { label: "한국어", value: "ko" },
  { label: "简体中文", value: "zh-CN" },
  { label: "繁體中文", value: "zh-TW" },
  { label: "हिन्दी", value: "hi" },
  { label: "العربية", value: "ar" },
  { label: "עברית", value: "he" },
];

@customElement("sandbox-features-section")
export class FeaturesSection extends LitElement {
  static override styles = [sectionStyles];

  @state() private _open = true;
  @state() private _theme: ThemeConfig = chatStore.getState().theme;
  @state() private _lang = i18next.language ?? "en";
  private _unsub!: () => void;
  private _onLang = (lng: string) => { this._lang = lng; };

  connectedCallback() {
    super.connectedCallback();
    this._unsub = chatStore.subscribe(() => { this._theme = chatStore.getState().theme; });
    i18next.on("languageChanged", this._onLang);
  }

  disconnectedCallback() {
    this._unsub?.();
    i18next.off("languageChanged", this._onLang);
    super.disconnectedCallback();
  }

  private _set(o: DeepPartial<ThemeConfig>) { chatStore.getState().setTheme(o); }

  render() {
    return html`
      <div class="section-header" @click=${() => (this._open = !this._open)}>
        <span class="section-label">Features</span>
        <svg class="chevron ${this._open ? "open" : ""}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      ${this._open ? html`
        <div class="section-body" style="display:flex;flex-direction:column;gap:10px">

          <!-- Search -->
          <div>
            <div class="sub-label">Search</div>
            <div class="toggle-group">
              <button class="tg-btn ${this._theme.enableSearch !== false ? "active" : ""}"
                @click=${() => this._set({ enableSearch: true })}>On</button>
              <button class="tg-btn ${this._theme.enableSearch === false ? "active" : ""}"
                @click=${() => this._set({ enableSearch: false })}>Off</button>
            </div>
          </div>

          <!-- Multi-Conversation -->
          <div>
            <div class="sub-label">Multi-Conversation</div>
            <div class="toggle-group">
              <button class="tg-btn ${this._theme.enableMultiConversation === true ? "active" : ""}"
                @click=${() => this._set({ enableMultiConversation: true })}>On</button>
              <button class="tg-btn ${this._theme.enableMultiConversation !== true ? "active" : ""}"
                @click=${() => this._set({ enableMultiConversation: false })}>Off</button>
            </div>
          </div>

          <!-- Language -->
          <div>
            <div class="sub-label">Language</div>
            <select
              style="width:100%"
              aria-label="Language"
              @change=${(e: Event) => i18next.changeLanguage((e.target as HTMLSelectElement).value)}>
              ${LANGUAGES.map((l) => html`
                <option value=${l.value} ?selected=${(i18next.resolvedLanguage ?? this._lang) === l.value}>${l.label}</option>
              `)}
            </select>
          </div>

        </div>
      ` : nothing}
    `;
  }
}
