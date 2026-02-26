import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  chatStore,
  DEFAULT_THEME,
  type ThemeConfig,
  type ThemeColors,
  type ButtonPosition,
  type ButtonSize,
  type SpaceLevel,
  type WindowMode,
  type DeepPartial,
} from "@chativa/core";

// ── Color presets (draggable) ─────────────────────────────────────────────
const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "Indigo",   value: "#4f46e5" },
  { label: "Violet",   value: "#7c3aed" },
  { label: "Pink",     value: "#db2777" },
  { label: "Red",      value: "#dc2626" },
  { label: "Orange",   value: "#ea580c" },
  { label: "Amber",    value: "#d97706" },
  { label: "Green",    value: "#16a34a" },
  { label: "Teal",     value: "#0d9488" },
  { label: "Sky",      value: "#0284c7" },
  { label: "Slate",    value: "#475569" },
  { label: "Black",    value: "#0f172a" },
  { label: "White",    value: "#f8fafc" },
];

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "primary",    label: "Primary" },
  { key: "secondary",  label: "Secondary" },
  { key: "background", label: "Background" },
  { key: "text",       label: "Text" },
  { key: "border",     label: "Border" },
];

const WINDOW_MODES: { label: string; value: WindowMode }[] = [
  { label: "Popup",  value: "popup" },
  { label: "Side",   value: "side-panel" },
  { label: "Full",   value: "fullscreen" },
  { label: "Inline", value: "inline" },
];

// ── ThemeBuilder snippet generator ───────────────────────────────────────
function generateSnippet(theme: ThemeConfig): string {
  const d = DEFAULT_THEME;
  const lines: string[] = ["ThemeBuilder.create()"];

  if (theme.colors.primary    !== d.colors.primary)    lines.push(`  .setPrimary("${theme.colors.primary}")`);
  if (theme.colors.secondary  !== d.colors.secondary)  lines.push(`  .setSecondary("${theme.colors.secondary}")`);
  if (theme.colors.background !== d.colors.background) lines.push(`  .setBackground("${theme.colors.background}")`);
  if (theme.colors.text       !== d.colors.text)       lines.push(`  .setText("${theme.colors.text}")`);
  if (theme.colors.border     !== d.colors.border)     lines.push(`  .setBorder("${theme.colors.border}")`);
  if (theme.position          !== d.position)          lines.push(`  .setPosition("${theme.position}")`);
  if (theme.size              !== d.size)              lines.push(`  .setSize("${theme.size}")`);
  if (theme.positionMargin    !== d.positionMargin)    lines.push(`  .setPositionMargin("${theme.positionMargin}")`);
  if (theme.showMessageStatus !== d.showMessageStatus) lines.push(`  .setShowMessageStatus(${theme.showMessageStatus})`);

  // Layout — only non-default keys
  const layoutDiff: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme.layout)) {
    if ((d.layout as Record<string, unknown>)[k] !== v) layoutDiff[k] = v as string;
  }
  if (Object.keys(layoutDiff).length > 0) {
    lines.push(`  .setLayout(${JSON.stringify(layoutDiff)})`);
  }

  if (theme.windowMode && theme.windowMode !== "popup") lines.push(`  .setWindowMode("${theme.windowMode}")`);
  if (theme.enableSearch === false)                     lines.push(`  .setEnableSearch(false)`);
  if (theme.enableMultiConversation)                    lines.push(`  .setEnableMultiConversation(true)`);

  if (lines.length === 1) lines.push("  // (all defaults)");
  lines.push("  .build()");
  return lines.join("\n");
}

@customElement("theme-editor-app")
export class ThemeEditorApp extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
    }

    /* ══════════ LEFT PANEL ══════════ */
    .editor-panel {
      width: 340px;
      min-width: 300px;
      background: white;
      border-right: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex-shrink: 0;
    }

    .panel-header {
      padding: 14px 18px 12px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white;
      flex-shrink: 0;
    }

    .panel-header h2 {
      font-size: 0.875rem;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .panel-header p {
      font-size: 0.75rem;
      opacity: 0.75;
    }

    .panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .panel-body::-webkit-scrollbar { width: 3px; }
    .panel-body::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }

    /* ══════════ SECTION ══════════ */
    .section { display: flex; flex-direction: column; gap: 10px; }

    .section-title {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #94a3b8;
    }

    .divider { height: 1px; background: #f1f5f9; }

    /* ══════════ COLOR PRESETS ROW ══════════ */
    .preset-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .preset-swatch {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: grab;
      transition: transform 0.15s, box-shadow 0.15s;
      outline: none;
      padding: 0;
    }

    .preset-swatch:hover {
      transform: scale(1.2);
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    }

    .preset-swatch:active { cursor: grabbing; }

    .preset-hint {
      font-size: 0.6875rem;
      color: #cbd5e1;
      align-self: center;
    }

    /* ══════════ COLOR FIELD ROW ══════════ */
    .color-fields { display: flex; flex-direction: column; gap: 8px; }

    .color-field {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 8px;
      border: 1.5px solid #e2e8f0;
      background: #f8fafc;
      transition: border-color 0.15s, background 0.15s;
    }

    .color-field.drop-target {
      border-color: #4f46e5;
      background: #ede9fe;
    }

    .color-field-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      width: 72px;
      flex-shrink: 0;
    }

    input[type="color"].color-wheel {
      -webkit-appearance: none;
      appearance: none;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1.5px solid #e2e8f0;
      cursor: pointer;
      padding: 2px;
      background: transparent;
      flex-shrink: 0;
    }

    input[type="color"].color-wheel::-webkit-color-swatch-wrapper { padding: 0; border-radius: 3px; }
    input[type="color"].color-wheel::-webkit-color-swatch { border: none; border-radius: 3px; }

    input.color-hex {
      flex: 1;
      height: 28px;
      border: 1.5px solid #e2e8f0;
      border-radius: 6px;
      padding: 0 8px;
      font-size: 0.8125rem;
      font-family: "SF Mono", "Fira Code", monospace;
      color: #0f172a;
      background: white;
      outline: none;
      transition: border-color 0.15s;
      min-width: 0;
    }

    input.color-hex:focus { border-color: #4f46e5; }

    /* ══════════ TOGGLE GROUP ══════════ */
    .toggle-group {
      display: flex;
      gap: 3px;
      background: #f1f5f9;
      border-radius: 9px;
      padding: 3px;
    }

    .tg-btn {
      flex: 1;
      padding: 6px 4px;
      border: none;
      border-radius: 7px;
      background: transparent;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }

    .tg-btn:hover { color: #0f172a; }

    .tg-btn.active {
      background: white;
      color: #4f46e5;
      font-weight: 600;
      box-shadow: 0 1px 5px rgba(0,0,0,0.09);
    }

    /* ══════════ POSITION GRID ══════════ */
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
      width: 52px;
      height: 30px;
      border: 1.5px solid #e2e8f0;
      border-radius: 7px;
      background: white;
      font-size: 0.6875rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      padding: 0;
    }

    .pos-corner:hover { background: #f1f5f9; border-color: #cbd5e1; }

    .pos-corner.active {
      background: #4f46e5;
      border-color: #4f46e5;
      color: white;
      box-shadow: 0 2px 8px rgba(79,70,229,0.3);
    }

    /* ══════════ LAYOUT INPUTS ══════════ */
    .layout-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .layout-field label {
      display: block;
      font-size: 0.6875rem;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 4px;
    }

    .layout-field input {
      width: 100%;
      height: 32px;
      border: 1.5px solid #e2e8f0;
      border-radius: 7px;
      padding: 0 8px;
      font-size: 0.8125rem;
      font-family: "SF Mono", "Fira Code", monospace;
      color: #0f172a;
      background: #f8fafc;
      outline: none;
      transition: border-color 0.15s, background 0.15s;
    }

    .layout-field input:focus { border-color: #4f46e5; background: white; }

    /* ══════════ TOGGLE SWITCHES ══════════ */
    .switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
    }

    .switch-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: #475569;
    }

    .switch {
      position: relative;
      width: 38px;
      height: 22px;
      flex-shrink: 0;
    }

    .switch input { opacity: 0; width: 0; height: 0; }

    .switch-track {
      position: absolute;
      inset: 0;
      background: #e2e8f0;
      border-radius: 11px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .switch-track::after {
      content: "";
      position: absolute;
      left: 3px;
      top: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      transition: transform 0.2s;
    }

    .switch input:checked + .switch-track { background: #4f46e5; }
    .switch input:checked + .switch-track::after { transform: translateX(16px); }

    /* ══════════ EXPORT SECTION ══════════ */
    .export-section { display: flex; flex-direction: column; gap: 8px; }

    .export-tabs {
      display: flex;
      gap: 3px;
      background: #f1f5f9;
      border-radius: 9px;
      padding: 3px;
    }

    .export-tab {
      flex: 1;
      padding: 6px;
      border: none;
      border-radius: 7px;
      background: transparent;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }

    .export-tab.active {
      background: white;
      color: #4f46e5;
      font-weight: 600;
      box-shadow: 0 1px 5px rgba(0,0,0,0.09);
    }

    .code-block {
      position: relative;
      background: #0f172a;
      border-radius: 10px;
      overflow: hidden;
    }

    .code-block pre {
      padding: 14px;
      font-size: 0.7rem;
      font-family: "SF Mono", "Fira Code", "Fira Mono", monospace;
      color: #e2e8f0;
      overflow-x: auto;
      white-space: pre;
      margin: 0;
      line-height: 1.6;
      max-height: 260px;
      overflow-y: auto;
    }

    .copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 10px;
      border-radius: 6px;
      border: none;
      background: rgba(255,255,255,0.1);
      color: #e2e8f0;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      font-family: inherit;
    }

    .copy-btn:hover { background: rgba(255,255,255,0.2); }
    .copy-btn.copied { background: #16a34a; color: white; }

    .reset-btn {
      width: 100%;
      padding: 8px;
      border-radius: 9px;
      border: 1.5px solid #e2e8f0;
      background: #f8fafc;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .reset-btn:hover { background: #f1f5f9; border-color: #cbd5e1; color: #0f172a; }

    /* ══════════ RIGHT PREVIEW ══════════ */
    .preview-area {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: repeating-conic-gradient(#e2e8f0 0% 25%, #f1f5f9 0% 50%) 0 0 / 24px 24px;
      overflow: hidden;
    }

    .preview-label {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.75rem;
      font-weight: 600;
      color: #94a3b8;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 4px 12px;
      pointer-events: none;
      white-space: nowrap;
    }

    .preview-hint {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.6875rem;
      color: #94a3b8;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 3px 10px;
      pointer-events: none;
      white-space: nowrap;
    }
  `;

  @state() private _theme: ThemeConfig = chatStore.getState().theme;
  @state() private _hexInputs: Record<keyof ThemeColors, string> = {
    primary:    chatStore.getState().theme.colors.primary,
    secondary:  chatStore.getState().theme.colors.secondary,
    background: chatStore.getState().theme.colors.background,
    text:       chatStore.getState().theme.colors.text,
    border:     chatStore.getState().theme.colors.border,
  };
  @state() private _dropTarget: keyof ThemeColors | null = null;
  @state() private _exportTab: "json" | "snippet" = "json";
  @state() private _copied = false;

  private _unsub!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = chatStore.subscribe(() => {
      const s = chatStore.getState();
      this._theme = s.theme;
      this._hexInputs = {
        primary:    s.theme.colors.primary,
        secondary:  s.theme.colors.secondary,
        background: s.theme.colors.background,
        text:       s.theme.colors.text,
        border:     s.theme.colors.border,
      };
    });
  }

  disconnectedCallback() { this._unsub?.(); super.disconnectedCallback(); }

  private _set(o: DeepPartial<ThemeConfig>) { chatStore.getState().setTheme(o); }

  private _setColor(key: keyof ThemeColors, value: string) {
    this._set({ colors: { [key]: value } as Partial<ThemeColors> });
  }

  private _applyHex(key: keyof ThemeColors) {
    const v = this._hexInputs[key];
    if (/^#[0-9a-fA-F]{6}$/.test(v)) this._setColor(key, v);
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────
  private _onPresetDragStart(e: DragEvent, color: string) {
    e.dataTransfer!.setData("text/plain", color);
    e.dataTransfer!.effectAllowed = "copy";
  }

  private _onFieldDragOver(e: DragEvent, key: keyof ThemeColors) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "copy";
    this._dropTarget = key;
  }

  private _onFieldDragLeave() {
    this._dropTarget = null;
  }

  private _onFieldDrop(e: DragEvent, key: keyof ThemeColors) {
    e.preventDefault();
    this._dropTarget = null;
    const color = e.dataTransfer!.getData("text/plain");
    if (/^#[0-9a-fA-F]{6}$/.test(color)) this._setColor(key, color);
  }

  // ── Export ──────────────────────────────────────────────────────────────
  private _exportText(): string {
    if (this._exportTab === "json") {
      return JSON.stringify(this._theme, null, 2);
    }
    return generateSnippet(this._theme);
  }

  private async _copy() {
    try {
      await navigator.clipboard.writeText(this._exportText());
      this._copied = true;
      setTimeout(() => { this._copied = false; }, 1800);
    } catch {
      // fallback
    }
  }

  private _reset() {
    chatStore.getState().setTheme(DEFAULT_THEME as DeepPartial<ThemeConfig>);
  }

  // ── Render helpers ──────────────────────────────────────────────────────
  private _renderColors() {
    const { colors } = this._theme;
    return html`
      <div class="section">
        <div class="section-title">Colors</div>

        <!-- Draggable presets -->
        <div>
          <div style="font-size:0.6875rem;font-weight:600;color:#94a3b8;margin-bottom:6px">
            Presets — drag onto a color field
          </div>
          <div class="preset-row">
            ${COLOR_PRESETS.map((p) => html`
              <button
                class="preset-swatch"
                style="background:${p.value}"
                title="${p.label} — drag to apply"
                draggable="true"
                @dragstart=${(e: DragEvent) => this._onPresetDragStart(e, p.value)}
                @click=${() => this._setColor("primary", p.value)}
              ></button>
            `)}
          </div>
        </div>

        <!-- Color field rows -->
        <div class="color-fields">
          ${COLOR_FIELDS.map(({ key, label }) => html`
            <div
              class="color-field ${this._dropTarget === key ? "drop-target" : ""}"
              @dragover=${(e: DragEvent) => this._onFieldDragOver(e, key)}
              @dragleave=${this._onFieldDragLeave}
              @drop=${(e: DragEvent) => this._onFieldDrop(e, key)}
            >
              <span class="color-field-label">${label}</span>
              <input
                type="color"
                class="color-wheel"
                .value=${colors[key]}
                @input=${(e: Event) => this._setColor(key, (e.target as HTMLInputElement).value)}
              />
              <input
                class="color-hex"
                type="text"
                maxlength="7"
                placeholder="#000000"
                .value=${this._hexInputs[key]}
                @input=${(e: Event) => {
                  this._hexInputs = { ...this._hexInputs, [key]: (e.target as HTMLInputElement).value };
                }}
                @change=${() => this._applyHex(key)}
                @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this._applyHex(key); }}
              />
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private _renderButton() {
    const { position, size, positionMargin } = this._theme;
    return html`
      <div class="section">
        <div class="section-title">Button</div>

        <!-- Position -->
        <div>
          <div style="font-size:0.6875rem;font-weight:600;color:#94a3b8;margin-bottom:6px">Position</div>
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

        <!-- Size -->
        <div>
          <div style="font-size:0.6875rem;font-weight:600;color:#94a3b8;margin-bottom:6px">Size</div>
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
          <div style="font-size:0.6875rem;font-weight:600;color:#94a3b8;margin-bottom:6px">Edge Margin</div>
          <div class="toggle-group">
            ${(["1","2","3","4","5"] as SpaceLevel[]).map((m) => html`
              <button class="tg-btn ${positionMargin === m ? "active" : ""}" @click=${() => this._set({ positionMargin: m })}>
                ${m}
              </button>
            `)}
          </div>
        </div>
      </div>
    `;
  }

  private _renderLayout() {
    const { layout } = this._theme;
    return html`
      <div class="section">
        <div class="section-title">Layout</div>
        <div class="layout-grid">
          ${(["width", "height", "maxWidth", "maxHeight"] as const).map((k) => html`
            <div class="layout-field">
              <label>${k}</label>
              <input
                type="text"
                .value=${layout[k] ?? ""}
                placeholder="e.g. 360px"
                @change=${(e: Event) => this._set({ layout: { [k]: (e.target as HTMLInputElement).value } })}
              />
            </div>
          `)}
        </div>

        <div>
          <div style="font-size:0.6875rem;font-weight:600;color:#94a3b8;margin-bottom:6px">Horizontal Space</div>
          <div class="toggle-group">
            ${(["1","2","3","4","5"] as SpaceLevel[]).map((s) => html`
              <button class="tg-btn ${layout.horizontalSpace === s ? "active" : ""}" @click=${() => this._set({ layout: { horizontalSpace: s } })}>${s}</button>
            `)}
          </div>
        </div>

        <div>
          <div style="font-size:0.6875rem;font-weight:600;color:#94a3b8;margin-bottom:6px">Vertical Space</div>
          <div class="toggle-group">
            ${(["1","2","3","4","5"] as SpaceLevel[]).map((s) => html`
              <button class="tg-btn ${layout.verticalSpace === s ? "active" : ""}" @click=${() => this._set({ layout: { verticalSpace: s } })}>${s}</button>
            `)}
          </div>
        </div>
      </div>
    `;
  }

  private _renderWindowMode() {
    const windowMode = this._theme.windowMode ?? "popup";
    return html`
      <div class="section">
        <div class="section-title">Window Mode</div>
        <div class="toggle-group">
          ${WINDOW_MODES.map((m) => html`
            <button class="tg-btn ${windowMode === m.value ? "active" : ""}" @click=${() => this._set({ windowMode: m.value })}>
              ${m.label}
            </button>
          `)}
        </div>
      </div>
    `;
  }

  private _renderFeatures() {
    const { showMessageStatus, enableSearch, enableMultiConversation } = this._theme;
    const _toggle = (key: keyof ThemeConfig, current: boolean | undefined, defaultVal: boolean) => {
      const current2 = current ?? defaultVal;
      this._set({ [key]: !current2 } as DeepPartial<ThemeConfig>);
    };

    return html`
      <div class="section">
        <div class="section-title">Features</div>
        <div class="switch-row">
          <span class="switch-label">Message Status</span>
          <label class="switch">
            <input type="checkbox" .checked=${showMessageStatus ?? true}
              @change=${() => _toggle("showMessageStatus", showMessageStatus, true)} />
            <span class="switch-track"></span>
          </label>
        </div>
        <div class="switch-row">
          <span class="switch-label">Search</span>
          <label class="switch">
            <input type="checkbox" .checked=${enableSearch ?? true}
              @change=${() => _toggle("enableSearch", enableSearch, true)} />
            <span class="switch-track"></span>
          </label>
        </div>
        <div class="switch-row">
          <span class="switch-label">Multi-Conversation</span>
          <label class="switch">
            <input type="checkbox" .checked=${enableMultiConversation ?? false}
              @change=${() => _toggle("enableMultiConversation", enableMultiConversation, false)} />
            <span class="switch-track"></span>
          </label>
        </div>
      </div>
    `;
  }

  private _renderExport() {
    const text = this._exportText();
    return html`
      <div class="section export-section">
        <div class="section-title">Export</div>
        <div class="export-tabs">
          <button class="export-tab ${this._exportTab === "json" ? "active" : ""}"
            @click=${() => { this._exportTab = "json"; }}>JSON</button>
          <button class="export-tab ${this._exportTab === "snippet" ? "active" : ""}"
            @click=${() => { this._exportTab = "snippet"; }}>ThemeBuilder</button>
        </div>
        <div class="code-block">
          <pre>${text}</pre>
          <button class="copy-btn ${this._copied ? "copied" : ""}" @click=${this._copy}>
            ${this._copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <button class="reset-btn" @click=${this._reset}>Reset to defaults</button>
      </div>
    `;
  }

  override render() {
    return html`
      <!-- LEFT PANEL -->
      <div class="editor-panel">
        <div class="panel-header">
          <h2>Theme Editor</h2>
          <p>Changes reflect instantly in the preview</p>
        </div>
        <div class="panel-body">
          ${this._renderColors()}
          <div class="divider"></div>
          ${this._renderButton()}
          <div class="divider"></div>
          ${this._renderLayout()}
          <div class="divider"></div>
          ${this._renderWindowMode()}
          <div class="divider"></div>
          ${this._renderFeatures()}
          <div class="divider"></div>
          ${this._renderExport()}
        </div>
      </div>

      <!-- RIGHT PREVIEW -->
      <div class="preview-area">
        <div class="preview-label">Live Preview</div>
        <chat-bot-button></chat-bot-button>
        <chat-iva connector="theme-preview"></chat-iva>
        <div class="preview-hint">Drag color presets onto field rows in the panel</div>
      </div>
    `;
  }
}
