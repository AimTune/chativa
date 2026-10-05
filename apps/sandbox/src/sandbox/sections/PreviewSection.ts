import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { sectionStyles } from "../sandboxShared";
import {
  FREE_DEFAULT_SIZE,
  PREVIEW_MAX_HIDDEN_WIDTH,
  PREVIEW_PRESETS,
  getPreviewState,
  setPreviewPreset,
  subscribePreview,
  type PreviewPresetId,
  type PreviewState,
} from "../previewState";

/**
 * Preview tab — picks the breakpoint `<sandbox-preview-stage>` renders the
 * widget at. The selection lives in `previewState`, so it persists across
 * tab switches until this tab's Reset (or Reset all) turns it off.
 */
@customElement("sandbox-preview-section")
export class PreviewSection extends LitElement {
  static override styles = [
    sectionStyles,
    css`
      .stack { display: flex; flex-direction: column; gap: 12px; }
      .preset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .preset {
        appearance: none;
        border: 1.5px solid #e2e8f0;
        background: white;
        color: #475569;
        font-family: inherit;
        font-size: 0.8125rem;
        font-weight: 600;
        padding: 8px 6px;
        border-radius: 9px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        transition: background 0.12s, border-color 0.12s, color 0.12s;
      }
      .preset:hover { background: #f1f5f9; border-color: #cbd5e1; color: #0f172a; }
      .preset.active { background: #4f46e5; border-color: #4f46e5; color: white; }
      .preset small { font-size: 0.6875rem; font-weight: 500; opacity: 0.75; }
      .note { font-size: 0.75rem; color: #64748b; line-height: 1.45; }
      .narrow-only { display: none; }
      @media (max-width: ${PREVIEW_MAX_HIDDEN_WIDTH}px) {
        .wide-only { display: none; }
        .narrow-only { display: block; }
      }
    `,
  ];

  @state() private _preview: PreviewState = getPreviewState();
  private _unsub?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = subscribePreview((s) => { this._preview = s; });
  }

  disconnectedCallback() { this._unsub?.(); super.disconnectedCallback(); }

  render() {
    const active = this._preview.preset;
    const free = this._preview.freeSize;
    const options: { id: PreviewPresetId; label: string; dim: string }[] = [
      ...PREVIEW_PRESETS.map((p) => ({ id: p.id, label: p.label, dim: `${p.width} × ${p.height}` })),
      {
        id: "free",
        label: "Free",
        dim: active === "free" || free.width !== FREE_DEFAULT_SIZE.width || free.height !== FREE_DEFAULT_SIZE.height
          ? `${free.width} × ${free.height}`
          : "drag the corner",
      },
    ];

    return html`
      <div class="stack">
        <p class="note narrow-only">
          The preview area is only available on viewports wider than ${PREVIEW_MAX_HIDDEN_WIDTH} px.
        </p>

        <div class="wide-only stack">
          <div>
            <div class="sub-label">Viewport</div>
            <div class="preset-grid">
              ${options.map((o) => html`
                <button
                  class="preset ${active === o.id ? "active" : ""}"
                  aria-pressed=${active === o.id}
                  @click=${() => setPreviewPreset(o.id)}
                >
                  <span>${o.label}</span>
                  <small>${o.dim}</small>
                </button>
              `)}
            </div>
          </div>

          ${active !== "off" ? html`
            <div class="actions">
              <button class="btn btn-ghost" @click=${() => setPreviewPreset("off")}>Close preview</button>
            </div>
          ` : nothing}

          <p class="note">
            Renders the page's widget in <code>windowMode: "inline"</code> inside a frame of the
            selected size, to the right of this panel. Presets larger than the free space are
            scaled down; the toolbar above the frame shows the real size. Free mode has a
            drag handle on the frame's bottom-right corner. The selection stays while you switch
            tabs. Reset closes the preview and restores the previous window mode; picking another
            window mode in Appearance also closes it.
          </p>
        </div>
      </div>
    `;
  }
}
