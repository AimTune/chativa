import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { DEFAULT_THEME, mergeTheme, type ThemeConfig, type DeepPartial, type LayoutConfig } from "@chativa/core";
import type { ButtonPosition, ButtonSize, SpaceLevel, WindowMode, ThemeColors } from "@chativa/core";

// CDN URL used only in the Export snippet (not for actual injection)
const CDN_PROD_URL = "https://unpkg.com/@chativa/ui/dist/chativa.js";

// ── Export generators ──────────────────────────────────────────────────────
function generateCdnSnippet(): string {
  return `<script type="module" src="${CDN_PROD_URL}"><\\/script>\n<chat-bot-button></chat-bot-button>\n<chat-iva connector="YOUR_CONNECTOR"></chat-iva>`;
}

function generateThemeBuilderCode(theme: ThemeConfig): string {
  const d = DEFAULT_THEME;
  const lines: string[] = ["ThemeBuilder.create()"];

  const c = theme.colors, dc = d.colors;
  if (c.primary    !== dc.primary)    lines.push(`  .setPrimary("${c.primary}")`);
  if (c.secondary  !== dc.secondary)  lines.push(`  .setSecondary("${c.secondary}")`);
  if (c.background !== dc.background) lines.push(`  .setBackground("${c.background}")`);
  if (c.text       !== dc.text)       lines.push(`  .setText("${c.text}")`);
  if (c.border     !== dc.border)     lines.push(`  .setBorder("${c.border}")`);

  if (theme.position       !== d.position)       lines.push(`  .setPosition("${theme.position}")`);
  if (theme.size           !== d.size)           lines.push(`  .setSize("${theme.size}")`);
  if (theme.positionMargin !== d.positionMargin) lines.push(`  .setPositionMargin("${theme.positionMargin}")`);

  const layoutKeys: (keyof LayoutConfig)[] = ["width","height","maxWidth","maxHeight","horizontalSpace","verticalSpace"];
  const layoutDiffs: Partial<LayoutConfig> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const k of layoutKeys) if (theme.layout[k] !== d.layout[k]) (layoutDiffs as any)[k] = theme.layout[k];
  if (Object.keys(layoutDiffs).length) lines.push(`  .setLayout(${JSON.stringify(layoutDiffs)})`);

  if (theme.showMessageStatus !== d.showMessageStatus)
    lines.push(`  .setShowMessageStatus(${theme.showMessageStatus})`);

  lines.push("  .build()");
  return lines.join("\n");
}

// ── Presets / constants ───────────────────────────────────────────────────
const COLOR_PRESETS = [
  { label: "Indigo",  value: "#4f46e5" }, { label: "Violet",  value: "#7c3aed" },
  { label: "Pink",    value: "#db2777" }, { label: "Red",     value: "#dc2626" },
  { label: "Orange",  value: "#ea580c" }, { label: "Green",   value: "#16a34a" },
  { label: "Sky",     value: "#0284c7" }, { label: "Slate",   value: "#475569" },
  { label: "Teal",    value: "#0d9488" }, { label: "Black",   value: "#0f172a" },
];

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "primary",    label: "Primary" },
  { key: "secondary",  label: "Secondary" },
  { key: "background", label: "Background" },
  { key: "text",       label: "Text" },
  { key: "border",     label: "Border" },
];

const WINDOW_MODES: { label: string; value: WindowMode }[] = [
  { label: "Popup", value: "popup" }, { label: "Side", value: "side-panel" },
  { label: "Full",  value: "fullscreen" }, { label: "Inline", value: "inline" },
];

// ── Chrome helpers ─────────────────────────────────────────────────────────
async function getTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

/** Inject content.js into the active tab (idempotent — guarded inside content.ts). */
async function injectScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
}

/** Send a message to the content script in the active tab. */
async function sendToTab(msg: Record<string, unknown>): Promise<unknown> {
  const id = await getTabId();
  if (!id) return undefined;
  try { return await chrome.tabs.sendMessage(id, msg); } catch { return undefined; }
}

/** Returns true if the widget script tag is already in the active tab. */
async function checkInjected(): Promise<boolean> {
  const resp = await sendToTab({ type: "chativa-ping" }) as { injected: boolean } | undefined;
  return resp?.injected ?? false;
}

async function loadSaved(): Promise<ThemeConfig> {
  const d = await chrome.storage.local.get("chativa_theme");
  return d.chativa_theme
    ? mergeTheme(DEFAULT_THEME, d.chativa_theme as DeepPartial<ThemeConfig>)
    : { ...DEFAULT_THEME };
}

function save(theme: ThemeConfig) {
  chrome.storage.local.set({ chativa_theme: theme }).catch(() => {});
}

// ── Component ─────────────────────────────────────────────────────────────
@customElement("chativa-ext-popup")
export class ChativaExtPopup extends LitElement {
  static override styles = css`
    :host {
      display: flex; flex-direction: column; height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    /* Header */
    .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 11px 14px 9px; flex-shrink: 0; }
    .header h1 { font-size: 0.875rem; font-weight: 700; }
    .header p  { font-size: 0.6875rem; opacity: 0.72; margin-top: 1px; }

    /* Body — scrollable */
    .body { flex: 1; overflow-y: auto; padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 0; }
    .body::-webkit-scrollbar { width: 3px; }
    .body::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }

    /* Section */
    .section-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 7px 0 4px; user-select: none; }
    .section-label  { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #94a3b8; transition: color 0.12s; }
    .section-header:hover .section-label { color: #64748b; }
    .chevron { color: #cbd5e1; transition: transform 0.18s, color 0.12s; }
    .chevron.open { transform: rotate(180deg); }
    .section-header:hover .chevron { color: #94a3b8; }
    .section-body { padding-bottom: 6px; display: flex; flex-direction: column; gap: 8px; }

    .divider { height: 1px; background: #f1f5f9; }
    .sub-label { font-size: 0.6875rem; font-weight: 600; color: #94a3b8; margin-bottom: 4px; }

    /* Color presets */
    .preset-row { display: flex; flex-wrap: wrap; gap: 5px; }
    .preset-swatch { width: 22px; height: 22px; border-radius: 50%; border: 2.5px solid transparent; cursor: grab; padding: 0; transition: transform 0.12s, box-shadow 0.12s; }
    .preset-swatch:hover { transform: scale(1.18); box-shadow: 0 2px 6px rgba(0,0,0,0.2); }

    /* Color field */
    .color-fields { display: flex; flex-direction: column; gap: 5px; }
    .color-field {
      display: flex; align-items: center; gap: 6px; padding: 5px 7px;
      border-radius: 7px; border: 1.5px solid #e2e8f0; background: #f8fafc;
      transition: border-color 0.12s, background 0.12s;
    }
    .color-field.drop-target { border-color: #4f46e5; background: #ede9fe; }
    .color-field-label { font-size: 0.6875rem; font-weight: 600; color: #64748b; width: 62px; flex-shrink: 0; }
    input[type="color"].cw {
      -webkit-appearance: none; appearance: none; width: 22px; height: 22px;
      border-radius: 5px; border: 1px solid #e2e8f0; padding: 2px;
      cursor: pointer; background: transparent; flex-shrink: 0;
    }
    input[type="color"].cw::-webkit-color-swatch-wrapper { padding: 0; border-radius: 3px; }
    input[type="color"].cw::-webkit-color-swatch { border: none; border-radius: 3px; }
    input.hex {
      flex: 1; height: 22px; border: 1.5px solid #e2e8f0; border-radius: 5px;
      padding: 0 6px; font-size: 0.6875rem; font-family: "SF Mono", monospace;
      color: #0f172a; background: white; outline: none; min-width: 0; transition: border-color 0.12s;
    }
    input.hex:focus { border-color: #4f46e5; }

    /* Toggle group */
    .tg { display: flex; gap: 3px; background: #f1f5f9; border-radius: 8px; padding: 3px; }
    .tg-btn { flex: 1; padding: 5px 3px; border: none; border-radius: 6px; background: transparent; font-size: 0.75rem; font-weight: 500; color: #64748b; cursor: pointer; font-family: inherit; transition: all 0.12s; }
    .tg-btn:hover { color: #0f172a; }
    .tg-btn.active { background: white; color: #4f46e5; font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }

    /* Position grid */
    .pos-grid {
      border: 1.5px solid #e2e8f0; border-radius: 8px; background: #f8fafc;
      display: grid; grid-template-columns: auto 1fr auto; grid-template-rows: auto 1fr auto;
      padding: 5px; gap: 3px; height: 66px;
    }
    .pos-btn {
      width: 48px; height: 26px; border: 1.5px solid #e2e8f0; border-radius: 6px;
      background: white; font-size: 0.625rem; font-weight: 700; color: #64748b;
      cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; transition: all 0.12s;
    }
    .pos-btn:hover { background: #f1f5f9; }
    .pos-btn.active { background: #4f46e5; border-color: #4f46e5; color: white; box-shadow: 0 2px 6px rgba(79,70,229,0.3); }

    /* Layout inputs */
    .layout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .layout-field label { display: block; font-size: 0.625rem; font-weight: 600; color: #94a3b8; margin-bottom: 3px; }
    .layout-field input {
      width: 100%; height: 28px; border: 1.5px solid #e2e8f0; border-radius: 6px;
      padding: 0 7px; font-size: 0.75rem; font-family: "SF Mono", monospace;
      color: #0f172a; background: #f8fafc; outline: none; transition: border-color 0.12s, background 0.12s;
    }
    .layout-field input:focus { border-color: #4f46e5; background: white; }

    /* Toggle switch */
    .switch-row { display: flex; align-items: center; justify-content: space-between; padding: 2px 0; }
    .switch-lbl { font-size: 0.8125rem; font-weight: 500; color: #475569; }
    .switch { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .sw-track { position: absolute; inset: 0; background: #e2e8f0; border-radius: 10px; cursor: pointer; transition: background 0.18s; }
    .sw-track::after { content: ""; position: absolute; left: 3px; top: 3px; width: 14px; height: 14px; border-radius: 50%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.18s; }
    .switch input:checked + .sw-track { background: #4f46e5; }
    .switch input:checked + .sw-track::after { transform: translateX(16px); }

    /* Export blocks */
    .export-blocks { display: flex; flex-direction: column; gap: 8px; }
    .export-item { display: flex; flex-direction: column; gap: 3px; }
    .export-item-header { display: flex; align-items: center; justify-content: space-between; }
    .export-item-label { font-size: 0.625rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #94a3b8; }
    .copy-btn {
      font-size: 0.625rem; font-weight: 600; padding: 2px 7px; border-radius: 5px;
      border: 1px solid #e2e8f0; background: white; color: #4f46e5; cursor: pointer;
      font-family: inherit; transition: background 0.1s, color 0.1s;
    }
    .copy-btn:hover { background: #4f46e5; color: white; border-color: #4f46e5; }
    .copy-btn.copied { background: #dcfce7; border-color: #86efac; color: #166534; }
    .code-block {
      background: #0f172a; color: #e2e8f0; border-radius: 7px; padding: 7px 9px;
      font-family: "SF Mono", "Fira Mono", monospace; font-size: 0.625rem; line-height: 1.55;
      white-space: pre; overflow-x: auto; max-height: 80px;
    }
    .code-block::-webkit-scrollbar { height: 3px; }
    .code-block::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

    /* Actions */
    .actions { display: flex; flex-direction: column; gap: 6px; padding-top: 6px; }
    .btn { width: 100%; padding: 9px 12px; border-radius: 9px; border: none; font-size: 0.8125rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity 0.12s, transform 0.12s; }
    .btn:hover { opacity: 0.88; }
    .btn:active { transform: scale(0.97); }
    .btn-inject { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; }
    .btn-update { background: #16a34a; color: white; }
    .btn-remove { background: #f1f5f9; border: 1.5px solid #e2e8f0; color: #64748b; }
    .status { font-size: 0.75rem; text-align: center; padding: 5px; border-radius: 7px; font-weight: 500; }
    .status.ok  { background: #dcfce7; color: #166534; }
    .status.err { background: #fee2e2; color: #991b1b; }
  `;

  @state() private _theme: ThemeConfig = { ...DEFAULT_THEME };
  @state() private _hexInputs: Record<keyof ThemeColors, string> = {
    primary: DEFAULT_THEME.colors.primary, secondary: DEFAULT_THEME.colors.secondary,
    background: DEFAULT_THEME.colors.background, text: DEFAULT_THEME.colors.text, border: DEFAULT_THEME.colors.border,
  };
  @state() private _dropTarget: keyof ThemeColors | null = null;
  @state() private _injected = false;
  @state() private _status: { msg: string; ok: boolean } | null = null;
  private _updateTimer: ReturnType<typeof setTimeout> | null = null;
  @state() private _openColors   = true;
  @state() private _openButton   = true;
  @state() private _openLayout   = false;
  @state() private _openFeatures = false;
  @state() private _openExport   = false;
  @state() private _copied: string | null = null;

  override async connectedCallback() {
    super.connectedCallback();
    const [theme, injected] = await Promise.all([loadSaved(), checkInjected()]);
    this._theme = theme;
    this._injected = injected;
    this._syncHex();
  }

  private _syncHex() {
    const c = this._theme.colors;
    this._hexInputs = { primary: c.primary, secondary: c.secondary, background: c.background, text: c.text, border: c.border };
  }

  private _set(o: DeepPartial<ThemeConfig>) {
    this._theme = mergeTheme(this._theme, o);
    this._syncHex();
    save(this._theme);
    if (this._injected) {
      if (this._updateTimer) clearTimeout(this._updateTimer);
      const t = this._theme;
      this._updateTimer = setTimeout(() => {
        sendToTab({ type: "chativa-update-theme", theme: t });
        this._updateTimer = null;
      }, 50);
    }
  }

  private _applyHex(key: keyof ThemeColors) {
    if (/^#[0-9a-fA-F]{6}$/.test(this._hexInputs[key]))
      this._set({ colors: { [key]: this._hexInputs[key] } as Partial<ThemeColors> });
  }

  private _onPresetDrag = (e: DragEvent, color: string) => {
    e.dataTransfer!.setData("text/plain", color);
    e.dataTransfer!.effectAllowed = "copy";
  };
  private _onFieldOver = (e: DragEvent, key: keyof ThemeColors) => {
    e.preventDefault(); e.dataTransfer!.dropEffect = "copy"; this._dropTarget = key;
  };
  private _onFieldDrop = (e: DragEvent, key: keyof ThemeColors) => {
    e.preventDefault(); this._dropTarget = null;
    const c = e.dataTransfer!.getData("text/plain");
    if (/^#[0-9a-fA-F]{6}$/.test(c)) this._set({ colors: { [key]: c } as Partial<ThemeColors> });
  };

  private async _inject() {
    this._status = { msg: "Injecting…", ok: true };
    const id = await getTabId();
    if (!id) { this._status = { msg: "Cannot inject on this page.", ok: false }; return; }
    try {
      await injectScript(id); // content.js (isolated world — messaging bridge)
      await chrome.scripting.executeScript({ target: { tabId: id }, files: ["inject-main.js"], world: "MAIN" });
      await sendToTab({ type: "chativa-update-theme", theme: this._theme });
      this._injected = true;
      this._status = { msg: "Widget injected!", ok: true };
    } catch {
      this._status = { msg: "Cannot inject on this page.", ok: false };
    }
  }

  private async _remove() {
    await sendToTab({ type: "chativa-remove" });
    this._injected = false;
    this._status = { msg: "Widget removed.", ok: true };
  }

  private _copy(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this._copied = key;
      setTimeout(() => { this._copied = null; }, 1500);
    });
  }

  private _chev = (open: boolean) => html`
    <svg class="chevron ${open ? "open" : ""}" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9l6 6 6-6"/>
    </svg>`;

  override render() {
    const { colors, position, size, positionMargin, layout, showMessageStatus, enableSearch, enableMultiConversation } = this._theme;
    const wm = this._theme.windowMode ?? "popup";

    return html`
      <div class="header">
        <h1>Chativa Theme Preview</h1>
        <p>Customize &amp; inject on any website</p>
      </div>

      <div class="body">

        <!-- Colors -->
        <div class="section-header" @click=${() => (this._openColors = !this._openColors)}>
          <span class="section-label">Colors</span>${this._chev(this._openColors)}
        </div>
        ${this._openColors ? html`
          <div class="section-body">
            <div>
              <div class="sub-label">Presets — drag onto a field</div>
              <div class="preset-row">
                ${COLOR_PRESETS.map((p) => html`
                  <button class="preset-swatch" style="background:${p.value}" title="${p.label}"
                    draggable="true"
                    @dragstart=${(e: DragEvent) => this._onPresetDrag(e, p.value)}
                    @click=${() => this._set({ colors: { primary: p.value } })}
                  ></button>`)}
              </div>
            </div>
            <div class="color-fields">
              ${COLOR_FIELDS.map(({ key, label }) => html`
                <div class="color-field ${this._dropTarget === key ? "drop-target" : ""}"
                  @dragover=${(e: DragEvent) => this._onFieldOver(e, key)}
                  @dragleave=${() => { this._dropTarget = null; }}
                  @drop=${(e: DragEvent) => this._onFieldDrop(e, key)}>
                  <span class="color-field-label">${label}</span>
                  <input type="color" class="cw" .value=${colors[key]}
                    @input=${(e: Event) => this._set({ colors: { [key]: (e.target as HTMLInputElement).value } as Partial<ThemeColors> })} />
                  <input class="hex" type="text" maxlength="7" .value=${this._hexInputs[key]}
                    @input=${(e: Event) => { this._hexInputs = { ...this._hexInputs, [key]: (e.target as HTMLInputElement).value }; }}
                    @change=${() => this._applyHex(key)}
                    @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this._applyHex(key); }} />
                </div>`)}
            </div>
          </div>
        ` : nothing}

        <div class="divider"></div>

        <!-- Button & Position -->
        <div class="section-header" @click=${() => (this._openButton = !this._openButton)}>
          <span class="section-label">Button &amp; Position</span>${this._chev(this._openButton)}
        </div>
        ${this._openButton ? html`
          <div class="section-body">
            <div>
              <div class="sub-label">Position</div>
              <div class="pos-grid">
                <button class="pos-btn ${position === "top-left"     ? "active" : ""}" @click=${() => this._set({ position: "top-left"     as ButtonPosition })}>↖ TL</button>
                <div></div>
                <button class="pos-btn ${position === "top-right"    ? "active" : ""}" @click=${() => this._set({ position: "top-right"    as ButtonPosition })}>TR ↗</button>
                <div></div><div></div><div></div>
                <button class="pos-btn ${position === "bottom-left"  ? "active" : ""}" @click=${() => this._set({ position: "bottom-left"  as ButtonPosition })}>↙ BL</button>
                <div></div>
                <button class="pos-btn ${position === "bottom-right" ? "active" : ""}" @click=${() => this._set({ position: "bottom-right" as ButtonPosition })}>BR ↘</button>
              </div>
            </div>
            <div>
              <div class="sub-label">Button Size</div>
              <div class="tg">
                ${(["small", "medium", "large"] as ButtonSize[]).map((s) => html`
                  <button class="tg-btn ${size === s ? "active" : ""}" @click=${() => this._set({ size: s })}>
                    ${s[0].toUpperCase() + s.slice(1)}
                  </button>`)}
              </div>
            </div>
            <div>
              <div class="sub-label">Edge Margin</div>
              <div class="tg">
                ${(["1","2","3","4","5"] as SpaceLevel[]).map((m) => html`
                  <button class="tg-btn ${positionMargin === m ? "active" : ""}" @click=${() => this._set({ positionMargin: m })}>${m}</button>`)}
              </div>
            </div>
            <div>
              <div class="sub-label">Window Mode</div>
              <div class="tg">
                ${WINDOW_MODES.map((m) => html`
                  <button class="tg-btn ${wm === m.value ? "active" : ""}" @click=${() => this._set({ windowMode: m.value })}>
                    ${m.label}
                  </button>`)}
              </div>
            </div>
          </div>
        ` : nothing}

        <div class="divider"></div>

        <!-- Layout -->
        <div class="section-header" @click=${() => (this._openLayout = !this._openLayout)}>
          <span class="section-label">Layout</span>${this._chev(this._openLayout)}
        </div>
        ${this._openLayout ? html`
          <div class="section-body">
            <div class="layout-grid">
              ${(["width", "height", "maxWidth", "maxHeight"] as const).map((k) => html`
                <div class="layout-field">
                  <label>${k}</label>
                  <input type="text" .value=${layout[k] ?? ""} placeholder="e.g. 360px"
                    @change=${(e: Event) => this._set({ layout: { [k]: (e.target as HTMLInputElement).value } })} />
                </div>`)}
            </div>
            <div>
              <div class="sub-label">H-Space</div>
              <div class="tg">
                ${(["1","2","3","4","5"] as SpaceLevel[]).map((s) => html`
                  <button class="tg-btn ${layout.horizontalSpace === s ? "active" : ""}" @click=${() => this._set({ layout: { horizontalSpace: s } })}>${s}</button>`)}
              </div>
            </div>
            <div>
              <div class="sub-label">V-Space</div>
              <div class="tg">
                ${(["1","2","3","4","5"] as SpaceLevel[]).map((s) => html`
                  <button class="tg-btn ${layout.verticalSpace === s ? "active" : ""}" @click=${() => this._set({ layout: { verticalSpace: s } })}>${s}</button>`)}
              </div>
            </div>
          </div>
        ` : nothing}

        <div class="divider"></div>

        <!-- Features -->
        <div class="section-header" @click=${() => (this._openFeatures = !this._openFeatures)}>
          <span class="section-label">Features</span>${this._chev(this._openFeatures)}
        </div>
        ${this._openFeatures ? html`
          <div class="section-body">
            <div class="switch-row">
              <span class="switch-lbl">Message Status</span>
              <label class="switch">
                <input type="checkbox" .checked=${showMessageStatus ?? true}
                  @change=${() => this._set({ showMessageStatus: !(showMessageStatus ?? true) })} />
                <span class="sw-track"></span>
              </label>
            </div>
            <div class="switch-row">
              <span class="switch-lbl">Search</span>
              <label class="switch">
                <input type="checkbox" .checked=${enableSearch ?? true}
                  @change=${() => this._set({ enableSearch: !(enableSearch ?? true) })} />
                <span class="sw-track"></span>
              </label>
            </div>
            <div class="switch-row">
              <span class="switch-lbl">Multi-Conversation</span>
              <label class="switch">
                <input type="checkbox" .checked=${enableMultiConversation ?? false}
                  @change=${() => this._set({ enableMultiConversation: !(enableMultiConversation ?? false) })} />
                <span class="sw-track"></span>
              </label>
            </div>
          </div>
        ` : nothing}

        <div class="divider"></div>

        <!-- Export -->
        <div class="section-header" @click=${() => (this._openExport = !this._openExport)}>
          <span class="section-label">Export</span>${this._chev(this._openExport)}
        </div>
        ${this._openExport ? html`
          <div class="section-body">
            <div class="export-blocks">
              ${([
                { key: "snippet", label: "CDN Snippet",    text: generateCdnSnippet() },
                { key: "json",    label: "JSON Config",    text: JSON.stringify(this._theme, null, 2) },
                { key: "builder", label: "ThemeBuilder",   text: generateThemeBuilderCode(this._theme) },
              ] as const).map(({ key, label, text }) => html`
                <div class="export-item">
                  <div class="export-item-header">
                    <span class="export-item-label">${label}</span>
                    <button class="copy-btn ${this._copied === key ? "copied" : ""}"
                      @click=${() => this._copy(key, text)}>
                      ${this._copied === key ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div class="code-block">${text}</div>
                </div>`)}
            </div>
          </div>
        ` : nothing}

        <div class="divider"></div>

        <!-- Actions -->
        <div class="actions">
          ${!this._injected ? html`
            <button class="btn btn-inject" @click=${this._inject}>Inject Widget on This Page</button>
          ` : html`
            <button class="btn btn-update" @click=${() => sendToTab({ type: "chativa-update-theme", theme: this._theme })}>
              Update Theme
            </button>
            <button class="btn btn-remove" @click=${this._remove}>Remove Widget</button>
          `}
          ${this._status ? html`<div class="status ${this._status.ok ? "ok" : "err"}">${this._status.msg}</div>` : nothing}
        </div>

      </div>
    `;
  }
}
