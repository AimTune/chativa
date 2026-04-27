import { LitElement, html, css, svg, nothing, type SVGTemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  chatStore,
  messageStore,
  DEFAULT_THEME,
  type DeepPartial,
  type ThemeConfig,
} from "@chativa/core";

import "./sections/AppearanceSection";
import "./sections/ConnectorSection";
import "./sections/FeaturesSection";
import "./sections/MessagesSection";
import "./sections/GenUISection";
import "./sections/TypingSection";
import "./sections/ActionsSection";
import "./sections/SurveySection";
import "./sections/ConfigSection";

type TabId =
  | "appearance"
  | "connector"
  | "features"
  | "messages"
  | "genui"
  | "typing"
  | "survey"
  | "actions"
  | "config";

interface TabDef {
  id: TabId;
  label: string;
  icon: SVGTemplateResult;
  /** Path under `docs/` that documents this tab. Renders as "Docs ↗". */
  docPath: string;
  /**
   * Override patch that resets the theme fields *this tab* controls back
   * to baseline. Tabs that don't drive theme state (messages, genui,
   * actions, connector, config) leave it unset and the Reset button hides.
   */
  reset?: DeepPartial<ThemeConfig>;
}

/**
 * The full Default-preset reset — every overridable field set to its
 * documented baseline. `mergeTheme` is a deep-merge, so booleans the
 * user has flipped need to be listed explicitly to actually return to
 * `true` / `false`. Mirrors the Default preset in `AppearanceSection`.
 */
const FULL_RESET: DeepPartial<ThemeConfig> = {
  ...DEFAULT_THEME,
  allowFullscreen: true,
  enableSearch: true,
  enableMultiConversation: false,
  enableFileUpload: true,
  hideButtonOnOpen: false,
  windowMode: "popup",
};

const APPEARANCE_RESET: DeepPartial<ThemeConfig> = {
  colors: DEFAULT_THEME.colors,
  position: DEFAULT_THEME.position,
  positionMargin: DEFAULT_THEME.positionMargin,
  size: DEFAULT_THEME.size,
  layout: DEFAULT_THEME.layout,
  windowMode: "popup",
  avatar: DEFAULT_THEME.avatar,
};

const FEATURES_RESET: DeepPartial<ThemeConfig> = {
  allowFullscreen: true,
  showMessageStatus: true,
  enableSearch: true,
  enableMultiConversation: false,
  enableFileUpload: true,
  hideButtonOnOpen: false,
};

const SURVEY_RESET: DeepPartial<ThemeConfig> = {
  endOfConversationSurvey: DEFAULT_THEME.endOfConversationSurvey,
};

const TABS: TabDef[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: svg`<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18" opacity=".4"/>`,
    docPath: "theming.md",
    reset: APPEARANCE_RESET,
  },
  {
    id: "connector",
    label: "Connector",
    icon: svg`<path d="M9 2v6m6-6v6"/><rect x="6" y="8" width="12" height="6" rx="1"/><path d="M12 14v8"/>`,
    docPath: "connectors/overview.md",
  },
  {
    id: "features",
    label: "Features",
    icon: svg`<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" opacity=".5"/>`,
    docPath: "configuration.md",
    reset: FEATURES_RESET,
  },
  {
    id: "messages",
    label: "Messages",
    icon: svg`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
    docPath: "message-types/overview.md",
  },
  {
    id: "genui",
    label: "GenUI",
    icon: svg`<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`,
    docPath: "genui/overview.md",
  },
  {
    id: "typing",
    label: "Typing",
    icon: svg`<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>`,
    docPath: "configuration.md",
  },
  {
    id: "survey",
    label: "Survey",
    icon: svg`<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
    docPath: "survey.md",
    reset: SURVEY_RESET,
  },
  {
    id: "actions",
    label: "Actions",
    icon: svg`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
    docPath: "architecture.md",
  },
  {
    id: "config",
    label: "Config",
    icon: svg`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
    docPath: "configuration.md",
  },
];

const DOCS_BASE = "https://github.com/AimTune/chativa/blob/main/docs";

@customElement("sandbox-controls")
export class SandboxControls extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
    }

    /* ── Collapsed toggle button ── */
    .toggle {
      position: fixed;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(79, 70, 229, 0.4);
      z-index: 9998;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .toggle:hover { transform: translateY(-50%) scale(1.1); }

    /* ── Panel ── */
    .panel {
      position: fixed;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 380px;
      background: white;
      border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.13), 0 2px 10px rgba(0,0,0,0.06);
      z-index: 9998;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 48px);
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 13px 16px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white;
      flex-shrink: 0;
    }

    .panel-title {
      font-size: 0.875rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .panel-close {
      width: 28px; height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(255,255,255,0.15);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      padding: 0;
      flex-shrink: 0;
    }
    .panel-close:hover { background: rgba(255,255,255,0.28); }
    .panel-close svg { width: 13px; height: 13px; }

    /* ── Two-pane body: left tab rail + right content ── */
    .panel-body {
      display: grid;
      grid-template-columns: 96px 1fr;
      flex: 1;
      min-height: 0;
    }

    /* ── Left rail ── */
    .tab-rail {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 6px;
      background: #f8fafc;
      border-right: 1px solid #f1f5f9;
      overflow-y: auto;
    }
    .tab-rail::-webkit-scrollbar { width: 3px; height: 3px; }
    .tab-rail::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }

    .tab {
      appearance: none;
      border: none;
      background: transparent;
      padding: 8px 6px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      color: #64748b;
      font-family: inherit;
      font-size: 0.6875rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
    }
    .tab svg {
      width: 18px; height: 18px;
      stroke: currentColor;
      stroke-width: 1.8;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      flex-shrink: 0;
    }
    .tab:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    .tab.active {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white;
      box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
    }
    .tab.active svg { stroke-width: 2; }

    .rail-divider {
      height: 1px;
      background: #e2e8f0;
      margin: 6px 4px;
    }

    .tab.tab-danger {
      color: #b91c1c;
    }
    .tab.tab-danger:hover {
      background: #fee2e2;
      color: #991b1b;
    }

    /* ── Right content pane ── */
    .tab-content {
      padding: 0;
      overflow-y: auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .tab-content::-webkit-scrollbar { width: 3px; }
    .tab-content::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }

    /* ── Per-tab toolbar (sticky inside the content pane) ── */
    .tab-toolbar {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 9px 14px;
      background: rgba(248, 250, 252, 0.92);
      backdrop-filter: saturate(160%) blur(6px);
      -webkit-backdrop-filter: saturate(160%) blur(6px);
      border-bottom: 1px solid #f1f5f9;
    }
    .toolbar-title {
      font-size: 0.6875rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #94a3b8;
    }
    .toolbar-actions {
      display: flex;
      gap: 6px;
    }
    .toolbar-link, .toolbar-btn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-family: inherit;
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid transparent;
      background: transparent;
      color: #64748b;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
    }
    .toolbar-link:hover {
      background: white;
      border-color: #e2e8f0;
      color: #4f46e5;
    }
    .toolbar-btn:hover {
      background: white;
      border-color: #e2e8f0;
      color: #b91c1c;
    }
    .toolbar-link svg, .toolbar-btn svg {
      width: 11px; height: 11px;
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .tab-pane { display: none; padding: 14px 16px; }
    .tab-pane.active { display: block; }

    /* ── Mobile / narrow viewports ── */
    @media (max-width: 768px) {
      .panel {
        left: 0;
        right: 0;
        top: auto;
        bottom: 0;
        transform: none;
        width: auto;
        max-height: 78vh;
        border-radius: 14px 14px 0 0;
      }
      .panel-body {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr;
      }
      .tab-rail {
        flex-direction: row;
        overflow-x: auto;
        overflow-y: hidden;
        border-right: none;
        border-bottom: 1px solid #f1f5f9;
        padding: 8px 10px;
      }
      .tab {
        flex-shrink: 0;
        min-width: 64px;
      }
      .rail-divider {
        width: 1px;
        height: 28px;
        margin: 0 6px;
        flex-shrink: 0;
      }
    }
  `;

  @state() private _isOpen = true;
  @state() private _activeTab: TabId = "appearance";

  private get _activeTabDef(): TabDef {
    return TABS.find((t) => t.id === this._activeTab) ?? TABS[0];
  }

  private _resetTab() {
    const def = this._activeTabDef;
    if (def.reset) chatStore.getState().setTheme(def.reset);
  }

  private _resetAll() {
    chatStore.getState().setTheme(FULL_RESET);
    messageStore.getState().clear();
  }

  render() {
    if (!this._isOpen) {
      return html`
        <button class="toggle" @click=${() => (this._isOpen = true)} title="Open customization panel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2v-.5c0-.46-.36-.84-.82-.84-.26 0-.5-.1-.68-.28-.18-.18-.28-.42-.28-.68 0-.55.45-1 1-1h1.25C19.25 17 22 14.25 22 10.88 22 5.95 17.52 2 12 2zm-5 9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
          </svg>
        </button>
      `;
    }

    const tab = this._activeTabDef;

    return html`
      <div class="panel">

        <div class="panel-header">
          <span class="panel-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2v-.5c0-.46-.36-.84-.82-.84-.26 0-.5-.1-.68-.28-.18-.18-.28-.42-.28-.68 0-.55.45-1 1-1h1.25C19.25 17 22 14.25 22 10.88 22 5.95 17.52 2 12 2zm-5 9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
            </svg>
            Customize
          </span>
          <button class="panel-close" @click=${() => (this._isOpen = false)} title="Minimize">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="panel-body">

          <nav class="tab-rail" role="tablist">
            ${TABS.map((t) => html`
              <button
                class="tab ${this._activeTab === t.id ? "active" : ""}"
                role="tab"
                aria-selected=${this._activeTab === t.id}
                title=${t.label}
                @click=${() => (this._activeTab = t.id)}
              >
                <svg viewBox="0 0 24 24">${t.icon}</svg>
                <span>${t.label}</span>
              </button>
            `)}
            <div class="rail-divider"></div>
            <button class="tab tab-danger" title="Reset every theme override and clear messages" @click=${() => this._resetAll()}>
              <svg viewBox="0 0 24 24">
                <path d="M3 12a9 9 0 1 0 3-6.7"/>
                <polyline points="3 4 3 9 8 9"/>
              </svg>
              <span>Reset all</span>
            </button>
            <div class="rail-divider"></div>
            <a class="tab" href="/agent-panel.html" title="Agent Panel Demo">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
              <span>Agent</span>
            </a>
            <a class="tab" href="/theme-editor.html" title="Visual Theme Editor">
              <svg viewBox="0 0 24 24">
                <circle cx="13.5" cy="6.5" r="2.5"/>
                <circle cx="17.5" cy="10.5" r="2.5"/>
                <circle cx="8.5" cy="7.5" r="2.5"/>
                <circle cx="6.5" cy="12.5" r="2.5"/>
                <path d="M12 20c-4 0-7-3-7-7s3-7 7-7"/>
              </svg>
              <span>Theme</span>
            </a>
          </nav>

          <div class="tab-content">

            <div class="tab-toolbar">
              <span class="toolbar-title">${tab.label}</span>
              <div class="toolbar-actions">
                <a
                  class="toolbar-link"
                  href="${DOCS_BASE}/${tab.docPath}"
                  target="_blank"
                  rel="noopener"
                  title="Open the docs page for this tab in a new tab"
                >
                  <span>Docs</span>
                  <svg viewBox="0 0 24 24"><path d="M14 3h7v7"/><path d="M21 3l-9 9"/><path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6"/></svg>
                </a>
                ${tab.reset
                  ? html`<button
                      class="toolbar-btn"
                      title="Reset every field this tab controls"
                      @click=${() => this._resetTab()}
                    >
                      <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/></svg>
                      <span>Reset</span>
                    </button>`
                  : nothing}
              </div>
            </div>

            <div class="tab-pane ${this._activeTab === "appearance" ? "active" : ""}">
              <sandbox-appearance-section></sandbox-appearance-section>
            </div>
            <div class="tab-pane ${this._activeTab === "connector" ? "active" : ""}">
              <sandbox-connector-section></sandbox-connector-section>
            </div>
            <div class="tab-pane ${this._activeTab === "features" ? "active" : ""}">
              <sandbox-features-section></sandbox-features-section>
            </div>
            <div class="tab-pane ${this._activeTab === "messages" ? "active" : ""}">
              <sandbox-messages-section></sandbox-messages-section>
            </div>
            <div class="tab-pane ${this._activeTab === "genui" ? "active" : ""}">
              <sandbox-genui-section></sandbox-genui-section>
            </div>
            <div class="tab-pane ${this._activeTab === "typing" ? "active" : ""}">
              <sandbox-typing-section></sandbox-typing-section>
            </div>
            <div class="tab-pane ${this._activeTab === "survey" ? "active" : ""}">
              <sandbox-survey-section></sandbox-survey-section>
            </div>
            <div class="tab-pane ${this._activeTab === "actions" ? "active" : ""}">
              <sandbox-actions-section></sandbox-actions-section>
            </div>
            <div class="tab-pane ${this._activeTab === "config" ? "active" : ""}">
              <sandbox-config-section></sandbox-config-section>
            </div>
          </div>

        </div>

      </div>
    `;
  }
}

export default SandboxControls;
