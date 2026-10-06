import { LitElement, html, css, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { chatStore } from "@chativa/core";
import {
  PREVIEW_PRESETS,
  getPreviewState,
  previewSizeOf,
  resetPreview,
  setPreviewFreeSize,
  setPreviewPreset,
  subscribePreview,
  type PreviewPresetId,
  type PreviewState,
} from "./previewState";

/** Padding (px) between the stage edges and the preview frame. */
const STAGE_PAD = 24;

/**
 * `<sandbox-preview-stage>` — the sandbox live-preview area (issue #13).
 *
 * Wraps the page's single `<chat-iva>` in its light DOM:
 *
 * ```html
 * <sandbox-preview-stage><chat-iva></chat-iva></sandbox-preview-stage>
 * ```
 *
 * - Preview **off**: the host is `display: contents` and renders a bare
 *   `<slot>`, so the widget behaves exactly as it does without the wrapper.
 * - Preview **on**: the host becomes a panel to the right of the controls and
 *   slots the widget into a frame sized to the selected preset. The widget
 *   runs in `windowMode: "inline"`, so it fills the frame. Presets larger than
 *   the available area are scaled down with a CSS transform; Free mode uses a
 *   native `resize: both` corner handle instead.
 *
 * Single instance, by design: `chatStore` / `messageStore` are global
 * singletons, so a second `<chat-iva>` would share `isOpened`, `theme` and
 * `windowMode` with the first (it could never be a popup while the other is
 * inline), and both would build a `ChatEngine` over the *same* registered
 * connector — two `connect()` calls, with the connector's single `onMessage`
 * handler overwritten by whichever engine initialised last. Re-parenting the
 * widget instead is not an option either: moving `<chat-iva>` fires
 * `disconnectedCallback`, which destroys the engine. Slotting it into a frame
 * that is always its parent keeps one engine and one connection throughout.
 */
@customElement("sandbox-preview-stage")
export class PreviewStage extends LitElement {
  static override styles = css`
    :host { display: contents; }

    :host([active]) {
      position: fixed;
      top: 16px;
      right: 16px;
      bottom: 16px;
      left: 412px; /* 16px gutter + 380px controls panel + 16px gap */
      display: flex;
      flex-direction: column;
      background: #eef2f7;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      z-index: 1;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
    }

    @media (max-width: 768px) {
      :host([active]) { display: none; }
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      background: white;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
    .title {
      font-size: 0.6875rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #94a3b8;
    }
    .chips { display: flex; gap: 4px; flex-wrap: wrap; }
    .chip {
      appearance: none;
      border: 1.5px solid #e2e8f0;
      background: white;
      color: #475569;
      font-family: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 999px;
      cursor: pointer;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .chip:hover { background: #f1f5f9; border-color: #cbd5e1; color: #0f172a; }
    .chip.active { background: #4f46e5; border-color: #4f46e5; color: white; }
    .chip .dim { font-weight: 500; opacity: 0.7; margin-left: 4px; }

    .size {
      margin-left: auto;
      font-family: "SF Mono", "Fira Code", monospace;
      font-size: 0.75rem;
      color: #475569;
      white-space: nowrap;
    }
    .exit {
      appearance: none;
      border: none;
      background: #f1f5f9;
      color: #475569;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .exit:hover { background: #fee2e2; color: #991b1b; }

    .viewport {
      position: relative;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: ${STAGE_PAD}px;
    }

    /* Occupies the *scaled* footprint so the frame centres correctly. */
    .footprint { position: relative; flex-shrink: 0; }

    .frame {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: top left;
      background: white;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.06);
      border-radius: 12px;
      overflow: hidden;
      /* A transform also makes the frame the containing block for any
         position: fixed descendant inside the widget. */
      transform: translateZ(0);
    }

    .frame.free {
      position: relative;
      resize: both;
      min-width: 280px;
      min-height: 400px;
    }

    ::slotted(chat-iva) {
      display: block;
      width: 100%;
      height: 100%;
    }

    .closed {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #64748b;
      font-size: 0.8125rem;
      pointer-events: none;
    }
    .closed button {
      pointer-events: auto;
      appearance: none;
      border: none;
      background: #4f46e5;
      color: white;
      font-family: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 8px 14px;
      border-radius: 9px;
      cursor: pointer;
    }
  `;

  @state() private _preview: PreviewState = getPreviewState();
  @state() private _isOpened = chatStore.getState().isOpened;
  /** Inner size of the viewport area, minus padding. */
  @state() private _avail = { width: 0, height: 0 };
  /** Measured size of the Free frame (it is resized by the user directly). */
  @state() private _freeMeasured: { width: number; height: number } | null = null;

  @query(".viewport") private _viewportEl?: HTMLElement;
  @query(".frame.free") private _freeEl?: HTMLElement;

  private _unsubPreview?: () => void;
  private _unsubStore?: () => void;
  private _viewportRO = new ResizeObserver(() => this._measureViewport());
  private _freeRO = new ResizeObserver(() => this._measureFree());
  private _observedViewport: Element | null = null;
  private _observedFree: Element | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this._unsubPreview = subscribePreview((s) => { this._preview = s; });
    this._unsubStore = chatStore.subscribe((s) => { this._isOpened = s.isOpened; });
  }

  override disconnectedCallback() {
    this._unsubPreview?.();
    this._unsubStore?.();
    this._viewportRO.disconnect();
    this._freeRO.disconnect();
    this._observedViewport = null;
    this._observedFree = null;
    document.documentElement.classList.remove("sandbox-preview-active");
    super.disconnectedCallback();
  }

  protected override updated() {
    const active = this._preview.preset !== "off";
    this.toggleAttribute("active", active);
    // Lets the host page hide the floating launcher while previewing.
    document.documentElement.classList.toggle("sandbox-preview-active", active);

    const vp = this._viewportEl ?? null;
    if (vp !== this._observedViewport) {
      this._viewportRO.disconnect();
      if (vp) this._viewportRO.observe(vp);
      this._observedViewport = vp;
    }
    const free = this._freeEl ?? null;
    if (free !== this._observedFree) {
      this._freeRO.disconnect();
      if (free) this._freeRO.observe(free);
      this._observedFree = free;
      // A stale `_freeMeasured` is harmless: observing the new Free frame
      // fires the observer before the next paint and overwrites it.
    }
  }

  private _measureViewport() {
    const el = this._viewportEl;
    if (!el) return;
    const width = Math.max(0, el.clientWidth - STAGE_PAD * 2);
    const height = Math.max(0, el.clientHeight - STAGE_PAD * 2);
    if (width !== this._avail.width || height !== this._avail.height) {
      this._avail = { width, height };
    }
  }

  private _measureFree() {
    const el = this._freeEl;
    if (!el) return;
    const size = { width: el.offsetWidth, height: el.offsetHeight };
    this._freeMeasured = size;
    setPreviewFreeSize(size);
  }

  private _renderChips() {
    const chips: { id: PreviewPresetId; label: string; dim?: string }[] = [
      ...PREVIEW_PRESETS.map((p) => ({ id: p.id, label: p.label, dim: `${p.width}×${p.height}` })),
      { id: "free", label: "Free" },
    ];
    return html`
      <div class="chips" role="group" aria-label="Preview size">
        ${chips.map((c) => html`
          <button
            class="chip ${this._preview.preset === c.id ? "active" : ""}"
            aria-pressed=${this._preview.preset === c.id}
            @click=${() => setPreviewPreset(c.id)}
          >${c.label}${c.dim ? html`<span class="dim">${c.dim}</span>` : nothing}</button>
        `)}
      </div>
    `;
  }

  override render() {
    const size = previewSizeOf(this._preview);
    if (!size) return html`<slot></slot>`;

    const isFree = this._preview.preset === "free";
    const { width: aw, height: ah } = this._avail;
    let frame;
    let readout: string;

    if (isFree) {
      // Native corner handle; clamp to the stage so the handle stays reachable.
      const measured = this._freeMeasured ?? size;
      readout = `${measured.width} × ${measured.height}`;
      frame = html`
        <div
          class="frame free"
          style=${styleMap({
            width: `${size.width}px`,
            height: `${size.height}px`,
            maxWidth: aw ? `${aw}px` : "none",
            maxHeight: ah ? `${ah}px` : "none",
          })}
        >
          <slot></slot>
          ${this._renderClosed()}
        </div>
      `;
    } else {
      const scale = aw && ah ? Math.min(1, aw / size.width, ah / size.height) : 1;
      readout = `${size.width} × ${size.height}` +
        (scale < 1 ? ` · ${Math.round(scale * 100)}%` : "");
      frame = html`
        <div
          class="footprint"
          style=${styleMap({
            width: `${size.width * scale}px`,
            height: `${size.height * scale}px`,
          })}
        >
          <div
            class="frame"
            style=${styleMap({
              width: `${size.width}px`,
              height: `${size.height}px`,
              transform: `scale(${scale})`,
            })}
          >
            <slot></slot>
            ${this._renderClosed()}
          </div>
        </div>
      `;
    }

    return html`
      <div class="toolbar">
        <span class="title">Preview</span>
        ${this._renderChips()}
        <span class="size" title="Actual widget size in CSS pixels">${readout}</span>
        <button class="exit" title="Close preview" aria-label="Close preview" @click=${() => resetPreview()}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="viewport">${frame}</div>
    `;
  }

  private _renderClosed() {
    if (this._isOpened) return nothing;
    return html`
      <div class="closed">
        <span>The widget is closed.</span>
        <button @click=${() => chatStore.getState().open()}>Open widget</button>
      </div>
    `;
  }
}

export default PreviewStage;
