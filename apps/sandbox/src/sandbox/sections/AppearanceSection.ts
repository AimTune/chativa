import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  chatStore,
  type ThemeConfig,
  type ButtonPosition,
  type ButtonSize,
  type SpaceLevel,
  type DeepPartial,
  type WindowMode,
} from "@chativa/core";
import { sectionStyles } from "../sandboxShared";

const COLOR_PRESETS = [
  { label: "Indigo", value: "#4f46e5" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Pink",   value: "#db2777" },
  { label: "Red",    value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Green",  value: "#16a34a" },
  { label: "Sky",    value: "#0284c7" },
  { label: "Slate",  value: "#475569" },
];

const WINDOW_MODES: { label: string; value: WindowMode }[] = [
  { label: "Popup",  value: "popup" },
  { label: "Side",   value: "side-panel" },
  { label: "Full",   value: "fullscreen" },
  { label: "Inline", value: "inline" },
];

@customElement("sandbox-appearance-section")
export class AppearanceSection extends LitElement {
  static override styles = [
    sectionStyles,
    css`
      .stack { display: flex; flex-direction: column; gap: 12px; }

      .pos-screen {
        border: 1.5px solid #e2e8f0;
        border-radius: 10px;
        background: #f8fafc;
        display: grid;
        grid-template-columns: auto 1fr auto;
        grid-template-rows: auto 1fr auto;
        padding: 7px;
        gap: 3px;
        height: 80px;
      }
      .pos-corner {
        width: 46px; height: 28px;
        border: 1.5px solid #e2e8f0;
        border-radius: 7px;
        background: white;
        font-size: 0.75rem; font-weight: 600; color: #64748b;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.15s; padding: 0;
      }
      .pos-corner:hover { background: #f1f5f9; border-color: #cbd5e1; }
      .pos-corner.active {
        background: #4f46e5; border-color: #4f46e5; color: white;
        box-shadow: 0 2px 8px rgba(79,70,229,0.3);
      }

      .colors { display: grid; grid-template-columns: repeat(8,1fr); gap: 6px; margin-bottom: 10px; }
      .color-swatch {
        width: 100%; aspect-ratio: 1; border-radius: 50%;
        border: 2.5px solid transparent;
        cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; padding: 0;
      }
      .color-swatch:hover { transform: scale(1.15); }
      .color-swatch.active {
        border-color: #0f172a; transform: scale(1.15);
        box-shadow: 0 0 0 2px white, 0 0 0 4px currentColor;
      }
      .color-row { display: flex; align-items: center; gap: 8px; }
      input[type="color"].color-native {
        -webkit-appearance: none; appearance: none;
        width: 34px; height: 34px; border-radius: 8px;
        border: 1.5px solid #e2e8f0; cursor: pointer; padding: 3px;
        background: transparent; flex-shrink: 0;
      }
      input[type="color"].color-native::-webkit-color-swatch-wrapper { padding: 0; border-radius: 4px; }
      input[type="color"].color-native::-webkit-color-swatch { border: none; border-radius: 4px; }
      .color-text {
        flex: 1; height: 34px; border: 1.5px solid #e2e8f0; border-radius: 8px;
        padding: 0 10px; font-size: 0.8125rem;
        font-family: "SF Mono", "Fira Code", monospace;
        color: #0f172a; background: #f8fafc; outline: none;
        transition: border-color 0.15s, background 0.15s;
      }
      .color-text:focus { border-color: #4f46e5; background: white; }
    `,
  ];

  @state() private _open = true;
  @state() private _theme: ThemeConfig = chatStore.getState().theme;
  @state() private _colorHex = chatStore.getState().theme.colors.primary;
  private _unsub!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = chatStore.subscribe(() => {
      const s = chatStore.getState();
      this._theme = s.theme;
      this._colorHex = s.theme.colors.primary;
    });
  }

  disconnectedCallback() { this._unsub?.(); super.disconnectedCallback(); }

  private _set(o: DeepPartial<ThemeConfig>) { chatStore.getState().setTheme(o); }

  private _applyHex() {
    if (/^#[0-9a-fA-F]{6}$/.test(this._colorHex))
      this._set({ colors: { primary: this._colorHex } });
  }

  render() {
    const { position, size, positionMargin, colors } = this._theme;
    const windowMode = this._theme.windowMode ?? "popup";
    return html`
      <div class="section-header" @click=${() => (this._open = !this._open)}>
        <span class="section-label">Appearance</span>
        <svg class="chevron ${this._open ? "open" : ""}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      ${this._open ? html`
        <div class="section-body stack">

          <!-- Position -->
          <div>
            <div class="sub-label">Position</div>
            <div class="pos-screen">
              <button class="pos-corner ${position === "top-left"     ? "active" : ""}" @click=${() => this._set({ position: "top-left"     as ButtonPosition })}>↖ TL</button>
              <div></div>
              <button class="pos-corner ${position === "top-right"    ? "active" : ""}" @click=${() => this._set({ position: "top-right"    as ButtonPosition })}>TR ↗</button>
              <div></div><div></div><div></div>
              <button class="pos-corner ${position === "bottom-left"  ? "active" : ""}" @click=${() => this._set({ position: "bottom-left"  as ButtonPosition })}>↙ BL</button>
              <div></div>
              <button class="pos-corner ${position === "bottom-right" ? "active" : ""}" @click=${() => this._set({ position: "bottom-right" as ButtonPosition })}>BR ↘</button>
            </div>
          </div>

          <!-- Color -->
          <div>
            <div class="sub-label">Primary Color</div>
            <div class="colors">
              ${COLOR_PRESETS.map((c) => html`
                <button
                  class="color-swatch ${colors.primary === c.value ? "active" : ""}"
                  style="background:${c.value};color:${c.value}"
                  @click=${() => this._set({ colors: { primary: c.value } })}
                  title="${c.label}"
                ></button>
              `)}
            </div>
            <div class="color-row">
              <input type="color" class="color-native" .value=${colors.primary}
                @input=${(e: Event) => this._set({ colors: { primary: (e.target as HTMLInputElement).value } })} />
              <input class="color-text" type="text" .value=${this._colorHex}
                maxlength="7" placeholder="#4f46e5"
                @input=${(e: Event) => { this._colorHex = (e.target as HTMLInputElement).value; }}
                @change=${this._applyHex}
                @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this._applyHex(); }} />
            </div>
          </div>

          <!-- Button Size -->
          <div>
            <div class="sub-label">Button Size</div>
            <div class="toggle-group">
              ${(["small", "medium", "large"] as ButtonSize[]).map((s) => html`
                <button class="tg-btn ${size === s ? "active" : ""}" @click=${() => this._set({ size: s })}>
                  ${s[0].toUpperCase() + s.slice(1)}
                </button>
              `)}
            </div>
          </div>

          <!-- Edge Margin -->
          <div>
            <div class="sub-label">Edge Margin</div>
            <div class="toggle-group">
              ${(["1","2","3","4","5"] as SpaceLevel[]).map((m) => html`
                <button class="tg-btn ${positionMargin === m ? "active" : ""}" @click=${() => this._set({ positionMargin: m })}>${m}</button>
              `)}
            </div>
          </div>

          <!-- Window Mode -->
          <div>
            <div class="sub-label">Window Mode</div>
            <div class="toggle-group">
              ${WINDOW_MODES.map((m) => html`
                <button class="tg-btn ${windowMode === m.value ? "active" : ""}" @click=${() => this._set({ windowMode: m.value })}>
                  ${m.label}
                </button>
              `)}
            </div>
          </div>

        </div>
      ` : nothing}
    `;
  }
}
