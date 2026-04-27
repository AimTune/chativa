import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  chatStore,
  DEFAULT_THEME,
  ConnectorRegistry,
  i18next,
  type ThemeConfig,
  type DeepPartial,
} from "@chativa/core";
import { sectionStyles } from "../sandboxShared";

const SETTINGS_SCHEMA_URL =
  "https://aimtune.github.io/chativa/schemas/chativa-settings.schema.json";

interface ChativaSettingsLike {
  $schema?: string;
  connector?: string;
  theme?: DeepPartial<ThemeConfig>;
  locale?: string;
  i18n?: Record<string, unknown>;
}

/**
 * Deep diff `current` against `defaults`. Returns only the keys whose values
 * differ — recursing into plain objects so nested overrides stay nested.
 *
 * Returns `undefined` when there is no difference (caller can skip the key).
 */
function diffAgainstDefault<T extends Record<string, unknown>>(
  current: T,
  defaults: T,
): Partial<T> | undefined {
  const out: Record<string, unknown> = {};
  let hasDiff = false;
  for (const key of Object.keys(current)) {
    const c = current[key];
    const d = (defaults as Record<string, unknown>)[key];
    if (isPlainObject(c) && isPlainObject(d)) {
      const sub = diffAgainstDefault(
        c as Record<string, unknown>,
        d as Record<string, unknown>,
      );
      if (sub !== undefined) {
        out[key] = sub;
        hasDiff = true;
      }
    } else if (!shallowEqual(c, d)) {
      out[key] = c;
      hasDiff = true;
    }
  }
  return hasDiff ? (out as Partial<T>) : undefined;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    (v.constructor === Object || Object.getPrototypeOf(v) === null)
  );
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      a.every((x, i) => shallowEqual(x, (b as unknown[])[i]))
    );
  }
  return false;
}

/** Build the ChativaSettings JSON from live store + connector state. */
function buildSettings(): ChativaSettingsLike {
  const state = chatStore.getState();
  const themeDiff = diffAgainstDefault(
    state.theme as unknown as Record<string, unknown>,
    DEFAULT_THEME as unknown as Record<string, unknown>,
  );
  const settings: ChativaSettingsLike = { $schema: SETTINGS_SCHEMA_URL };
  if (state.activeConnector) settings.connector = state.activeConnector;
  if (themeDiff) settings.theme = themeDiff as DeepPartial<ThemeConfig>;
  const lng = i18next.isInitialized ? i18next.language : undefined;
  if (lng && lng !== "en") settings.locale = lng;
  return settings;
}

/** Build the HTML embed snippet from the current settings. */
function buildHtmlSnippet(settings: ChativaSettingsLike): string {
  // Strip the $schema field — it isn't valid for window.chativaSettings.
  const { $schema: _ignored, ...runtime } = settings;
  void _ignored;
  const json = JSON.stringify(runtime, null, 2);
  return `<script>
  window.chativaSettings = ${json};
</script>
<script type="module" src="https://unpkg.com/@chativa/ui/dist/chativa.js"></script>
<chat-bot-button></chat-bot-button>
<chat-iva></chat-iva>`;
}

/**
 * Loose validator — checks the shape against ChativaSettings without pulling
 * in a JSON-Schema runtime. Returns an error message or `null` on success.
 *
 * Strict validation lives in the JSON Schema (`schemas/chativa-settings.schema.json`)
 * — editors that understand `$schema` catch field-level errors there.
 */
function validateSettings(input: unknown): string | null {
  if (!isPlainObject(input)) return "Top-level value must be an object.";
  const obj = input as Record<string, unknown>;
  if ("connector" in obj && typeof obj.connector !== "string") {
    return "`connector` must be a string (the registered connector name).";
  }
  if ("connector" in obj) {
    const name = obj.connector as string;
    if (!ConnectorRegistry.has(name)) {
      const known = ConnectorRegistry.list().join(", ") || "(none)";
      return `Connector "${name}" is not registered. Available: ${known}.`;
    }
  }
  if ("theme" in obj && !isPlainObject(obj.theme)) {
    return "`theme` must be an object.";
  }
  if ("locale" in obj && typeof obj.locale !== "string") {
    return "`locale` must be a string (BCP-47, e.g. \"en\").";
  }
  if ("i18n" in obj && !isPlainObject(obj.i18n)) {
    return "`i18n` must be an object.";
  }
  return null;
}

/** Apply parsed settings to the live store. */
function applySettings(settings: ChativaSettingsLike): void {
  if (settings.connector) {
    chatStore.getState().setConnector(settings.connector);
  }
  if (settings.theme) {
    chatStore.getState().setTheme(settings.theme);
  }
  if (settings.locale && i18next.isInitialized) {
    void i18next.changeLanguage(settings.locale);
  }
}

@customElement("sandbox-config-section")
export class ConfigSection extends LitElement {
  static override styles = [
    sectionStyles,
    css`
      .stack { display: flex; flex-direction: column; gap: 10px; }

      .tabs {
        display: flex;
        gap: 3px;
        background: #f1f5f9;
        border-radius: 9px;
        padding: 3px;
      }
      .tab-btn {
        flex: 1;
        padding: 6px 4px;
        border: none;
        border-radius: 7px;
        background: transparent;
        font-size: 0.75rem;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
      }
      .tab-btn:hover { color: #0f172a; }
      .tab-btn.active {
        background: white;
        color: #4f46e5;
        font-weight: 600;
        box-shadow: 0 1px 5px rgba(0, 0, 0, 0.09);
      }

      .code-block {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 8px;
        padding: 9px 11px;
        font-family: "SF Mono", "Fira Mono", Menlo, monospace;
        font-size: 0.6875rem;
        line-height: 1.55;
        white-space: pre;
        overflow: auto;
        max-height: 220px;
      }
      .code-block::-webkit-scrollbar { width: 4px; height: 4px; }
      .code-block::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

      .row {
        display: flex;
        gap: 6px;
      }
      .copy-btn, .download-btn, .apply-btn, .clear-btn {
        flex: 1;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 7px 9px;
        border-radius: 7px;
        border: 1.5px solid #e2e8f0;
        background: white;
        color: #4f46e5;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
      }
      .copy-btn:hover, .download-btn:hover, .apply-btn:hover, .clear-btn:hover {
        background: #4f46e5;
        color: white;
        border-color: #4f46e5;
      }
      .copy-btn.copied {
        background: #dcfce7;
        border-color: #86efac;
        color: #166534;
      }
      .clear-btn { color: #64748b; }
      .clear-btn:hover { background: #64748b; border-color: #64748b; }

      .paste-area {
        width: 100%;
        min-height: 110px;
        font-family: "SF Mono", "Fira Mono", Menlo, monospace;
        font-size: 0.6875rem;
        padding: 9px 11px;
        border: 1.5px solid #e2e8f0;
        border-radius: 8px;
        background: #f8fafc;
        color: #0f172a;
        resize: vertical;
        outline: none;
        transition: border-color 0.12s;
        box-sizing: border-box;
      }
      .paste-area:focus { border-color: #4f46e5; background: white; }

      .feedback {
        font-size: 0.6875rem;
        font-weight: 500;
        padding: 6px 9px;
        border-radius: 7px;
        line-height: 1.4;
      }
      .feedback.ok  { background: #dcfce7; color: #166534; }
      .feedback.err { background: #fee2e2; color: #991b1b; }
    `,
  ];

  @state() private _open = true;
  @state() private _tab: "json" | "html" | "import" = "json";
  @state() private _copied: "json" | "html" | null = null;
  @state() private _settings: ChativaSettingsLike = buildSettings();
  @state() private _pasted = "";
  @state() private _feedback: { msg: string; ok: boolean } | null = null;

  private _unsub!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = chatStore.subscribe(() => {
      this._settings = buildSettings();
    });
  }

  disconnectedCallback() {
    this._unsub?.();
    super.disconnectedCallback();
  }

  private _json(): string {
    return JSON.stringify(this._settings, null, 2);
  }

  private _html(): string {
    return buildHtmlSnippet(this._settings);
  }

  private async _copy(key: "json" | "html") {
    const text = key === "json" ? this._json() : this._html();
    try {
      await navigator.clipboard.writeText(text);
      this._copied = key;
      setTimeout(() => {
        if (this._copied === key) this._copied = null;
      }, 1500);
    } catch {
      this._feedback = { msg: "Clipboard write failed.", ok: false };
    }
  }

  private _download() {
    const blob = new Blob([this._json()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chativa.config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private _apply() {
    this._feedback = null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(this._pasted);
    } catch (err) {
      this._feedback = {
        msg: `Invalid JSON: ${(err as Error).message}`,
        ok: false,
      };
      return;
    }
    const validationError = validateSettings(parsed);
    if (validationError) {
      this._feedback = { msg: validationError, ok: false };
      return;
    }
    applySettings(parsed as ChativaSettingsLike);
    this._feedback = { msg: "Applied to live store.", ok: true };
  }

  private _clear() {
    this._pasted = "";
    this._feedback = null;
  }

  render() {
    return html`
      <div class="section-header" @click=${() => (this._open = !this._open)}>
        <span class="section-label">Config</span>
        <svg class="chevron ${this._open ? "open" : ""}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      ${this._open
        ? html`
            <div class="section-body stack">

              <div class="tabs" role="tablist">
                <button class="tab-btn ${this._tab === "json" ? "active" : ""}" @click=${() => (this._tab = "json")}>JSON</button>
                <button class="tab-btn ${this._tab === "html" ? "active" : ""}" @click=${() => (this._tab = "html")}>HTML</button>
                <button class="tab-btn ${this._tab === "import" ? "active" : ""}" @click=${() => (this._tab = "import")}>Import</button>
              </div>

              ${this._tab === "json"
                ? html`
                    <div class="code-block">${this._json()}</div>
                    <div class="row">
                      <button class="copy-btn ${this._copied === "json" ? "copied" : ""}" @click=${() => this._copy("json")}>
                        ${this._copied === "json" ? "Copied!" : "Copy JSON"}
                      </button>
                      <button class="download-btn" @click=${() => this._download()}>Download</button>
                    </div>
                  `
                : nothing}

              ${this._tab === "html"
                ? html`
                    <div class="code-block">${this._html()}</div>
                    <div class="row">
                      <button class="copy-btn ${this._copied === "html" ? "copied" : ""}" @click=${() => this._copy("html")}>
                        ${this._copied === "html" ? "Copied!" : "Copy HTML"}
                      </button>
                    </div>
                  `
                : nothing}

              ${this._tab === "import"
                ? html`
                    <textarea
                      class="paste-area"
                      placeholder='Paste a ChativaSettings JSON here, e.g.\n{\n  "connector": "dummy",\n  "theme": { "colors": { "primary": "#0ea5e9" } }\n}'
                      .value=${this._pasted}
                      @input=${(e: Event) => {
                        this._pasted = (e.target as HTMLTextAreaElement).value;
                      }}
                    ></textarea>
                    <div class="row">
                      <button class="apply-btn" @click=${() => this._apply()}>Apply</button>
                      <button class="clear-btn" @click=${() => this._clear()}>Clear</button>
                    </div>
                    ${this._feedback
                      ? html`<div class="feedback ${this._feedback.ok ? "ok" : "err"}">${this._feedback.msg}</div>`
                      : nothing}
                  `
                : nothing}

            </div>
          `
        : nothing}
    `;
  }
}
