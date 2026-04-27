import { LitElement, html, css, svg, type SVGTemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import "./sections/AppearanceSection";
import "./sections/FeaturesSection";
import "./sections/MessagesSection";
import "./sections/GenUISection";
import "./sections/TypingSection";
import "./sections/ActionsSection";
import "./sections/SurveySection";
import "./sections/ConfigSection";

type TabId =
  | "appearance"
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
}

const TABS: TabDef[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: svg`<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18" opacity=".4"/>`,
  },
  {
    id: "features",
    label: "Features",
    icon: svg`<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" opacity=".5"/>`,
  },
  {
    id: "messages",
    label: "Messages",
    icon: svg`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  },
  {
    id: "genui",
    label: "GenUI",
    icon: svg`<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`,
  },
  {
    id: "typing",
    label: "Typing",
    icon: svg`<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>`,
  },
  {
    id: "survey",
    label: "Survey",
    icon: svg`<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  },
  {
    id: "actions",
    label: "Actions",
    icon: svg`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  },
  {
    id: "config",
    label: "Config",
    icon: svg`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  },
];

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
    .tab-rail::-webkit-scrollbar { width: 3px; }
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

    /* ── Right content pane ── */
    .tab-content {
      padding: 14px 16px;
      overflow-y: auto;
      min-width: 0;
    }
    .tab-content::-webkit-scrollbar { width: 3px; }
    .tab-content::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }

    .tab-pane { display: none; }
    .tab-pane.active { display: block; }
  `;

  @state() private _isOpen = true;
  @state() private _activeTab: TabId = "appearance";

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
            ${TABS.map((tab) => html`
              <button
                class="tab ${this._activeTab === tab.id ? "active" : ""}"
                role="tab"
                aria-selected=${this._activeTab === tab.id}
                title=${tab.label}
                @click=${() => (this._activeTab = tab.id)}
              >
                <svg viewBox="0 0 24 24">${tab.icon}</svg>
                <span>${tab.label}</span>
              </button>
            `)}
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
            <div class="tab-pane ${this._activeTab === "appearance" ? "active" : ""}">
              <sandbox-appearance-section></sandbox-appearance-section>
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
