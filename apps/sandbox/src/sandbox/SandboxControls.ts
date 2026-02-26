import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import "./sections/AppearanceSection";
import "./sections/FeaturesSection";
import "./sections/MessagesSection";
import "./sections/GenUISection";
import "./sections/ActionsSection";

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
      width: 272px;
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

    /* ── Scrollable body ── */
    .panel-body {
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 0;
      overflow-y: auto;
      flex: 1;
    }
    .panel-body::-webkit-scrollbar { width: 3px; }
    .panel-body::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }

    /* ── Dividers between sections ── */
    .divider {
      height: 1px;
      background: #f1f5f9;
      margin: 10px 0;
    }
  `;

  @state() private _isOpen = true;

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
          <sandbox-appearance-section></sandbox-appearance-section>
          <div class="divider"></div>
          <sandbox-features-section></sandbox-features-section>
          <div class="divider"></div>
          <sandbox-messages-section></sandbox-messages-section>
          <div class="divider"></div>
          <sandbox-genui-section></sandbox-genui-section>
          <div class="divider"></div>
          <sandbox-actions-section></sandbox-actions-section>
        </div>

      </div>
    `;
  }
}

export default SandboxControls;
