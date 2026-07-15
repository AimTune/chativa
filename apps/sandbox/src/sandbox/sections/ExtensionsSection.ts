import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ExtensionRegistry, LinkPreviewExtension, type LinkPreviewExtensionOptions } from "@chativa/core";
import { sectionStyles } from "../sandboxShared";

interface ExtensionConfig {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  options: LinkPreviewExtensionOptions;
}

@customElement("sandbox-extensions-section")
export class ExtensionsSection extends LitElement {
  static override styles = [
    sectionStyles,
    css`
      .extension-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 10px;
      }
      .extension-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .extension-name {
        font-size: 0.875rem;
        font-weight: 600;
        color: #0f172a;
      }
      .extension-desc {
        font-size: 0.75rem;
        color: #64748b;
        margin-bottom: 10px;
        line-height: 1.4;
      }
      .toggle-switch {
        position: relative;
        width: 44px;
        height: 24px;
        background: #cbd5e1;
        border-radius: 12px;
        cursor: pointer;
        transition: background 0.2s;
        flex-shrink: 0;
      }
      .toggle-switch.active {
        background: #4f46e5;
      }
      .toggle-switch::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        transition: transform 0.2s;
      }
      .toggle-switch.active::after {
        transform: translateX(20px);
      }
      .option-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #e2e8f0;
      }
      .option-label {
        font-size: 0.75rem;
        color: #475569;
        font-weight: 500;
      }
      .option-input {
        width: 60px;
        padding: 4px 8px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 0.75rem;
        text-align: center;
      }
      .option-input:focus {
        outline: none;
        border-color: #4f46e5;
      }
      .variant-group {
        display: flex;
        gap: 3px;
        background: #f1f5f9;
        border-radius: 7px;
        padding: 2px;
      }
      .variant-btn {
        padding: 4px 10px;
        border: none;
        border-radius: 5px;
        background: transparent;
        font-size: 0.7rem;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
      }
      .variant-btn:hover { color: #0f172a; }
      .variant-btn.active {
        background: white;
        color: #4f46e5;
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.09);
      }
    `,
  ];

  @state() private _extensions: ExtensionConfig[] = [
    {
      id: "link-preview",
      name: "Link Preview",
      description: "Extracts URLs from messages and displays rich preview cards. Supports compact and expanded variants.",
      installed: false,
      options: {
        maxUrlsPerMessage: 3,
        defaultVariant: "compact",
      },
    },
  ];

  override connectedCallback() {
    super.connectedCallback();
    this._syncInstalledState();
  }

  private _syncInstalledState() {
    this._extensions = this._extensions.map((ext) => ({
      ...ext,
      installed: ExtensionRegistry.has(ext.id),
    }));
  }

  private _toggleExtension(ext: ExtensionConfig) {
    if (ext.installed) {
      ExtensionRegistry.uninstall(ext.id);
      ext.installed = false;
    } else {
      this._installExtension(ext);
      ext.installed = true;
    }
    this.requestUpdate();
  }

  private _installExtension(ext: ExtensionConfig) {
    if (ext.id === "link-preview") {
      ExtensionRegistry.install(new LinkPreviewExtension(ext.options));
    }
  }

  private _updateMaxUrls(ext: ExtensionConfig, value: string) {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1) return;

    ext.options.maxUrlsPerMessage = numValue;
    this._reinstallIfActive(ext);
  }

  private _updateVariant(ext: ExtensionConfig, variant: "compact" | "expanded") {
    ext.options.defaultVariant = variant;
    this._reinstallIfActive(ext);
  }

  private _reinstallIfActive(ext: ExtensionConfig) {
    if (ext.installed) {
      ExtensionRegistry.uninstall(ext.id);
      this._installExtension(ext);
    }
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="section-header">
        <span class="section-label">Extensions</span>
      </div>
      <div class="section-body">
        ${this._extensions.map(
          (ext) => html`
            <div class="extension-card">
              <div class="extension-header">
                <div>
                  <div class="extension-name">${ext.name}</div>
                  <div class="extension-desc">${ext.description}</div>
                </div>
                <div
                  class="toggle-switch ${ext.installed ? "active" : ""}"
                  @click=${() => this._toggleExtension(ext)}
                ></div>
              </div>
              ${ext.installed
                ? html`
                    <div class="option-row">
                      <span class="option-label">Max URLs per message</span>
                      <input
                        type="number"
                        class="option-input"
                        .value=${String(ext.options.maxUrlsPerMessage)}
                        min="1"
                        max="10"
                        @change=${(e: Event) =>
                          this._updateMaxUrls(
                            ext,
                            (e.target as HTMLInputElement).value
                          )}
                      />
                    </div>
                    <div class="option-row">
                      <span class="option-label">Default variant</span>
                      <div class="variant-group">
                        <button
                          class="variant-btn ${ext.options.defaultVariant === "compact" ? "active" : ""}"
                          @click=${() => this._updateVariant(ext, "compact")}
                        >Compact</button>
                        <button
                          class="variant-btn ${ext.options.defaultVariant === "expanded" ? "active" : ""}"
                          @click=${() => this._updateVariant(ext, "expanded")}
                        >Expanded</button>
                      </div>
                    </div>
                  `
                : nothing}
            </div>
          `
        )}
      </div>
    `;
  }
}
