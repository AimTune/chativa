import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { chatStore, type ThemeConfig, type DeepPartial } from "@chativa/core";
import { i18n } from "@chativa/ui";
import { sectionStyles } from "../sandboxShared";

@customElement("sandbox-features-section")
export class FeaturesSection extends LitElement {
  static override styles = [sectionStyles];

  @state() private _open = true;
  @state() private _theme: ThemeConfig = chatStore.getState().theme;
  @state() private _lang = i18n.language;
  private _unsub!: () => void;
  private _onLang = (lng: string) => { this._lang = lng; };

  connectedCallback() {
    super.connectedCallback();
    this._unsub = chatStore.subscribe(() => { this._theme = chatStore.getState().theme; });
    i18n.on("languageChanged", this._onLang);
  }

  disconnectedCallback() {
    this._unsub?.();
    i18n.off("languageChanged", this._onLang);
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
            <div class="toggle-group">
              ${([{ label: "English", value: "en" }, { label: "Türkçe", value: "tr" }]).map((l) => html`
                <button class="tg-btn ${this._lang.startsWith(l.value) ? "active" : ""}"
                  @click=${() => i18n.changeLanguage(l.value)}>${l.label}</button>
              `)}
            </div>
          </div>

        </div>
      ` : nothing}
    `;
  }
}
