import { html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";
import type { GenUIComponentAPI } from "../types";

export interface GenUIImage {
  src: string;
  alt?: string;
  caption?: string;
}

/**
 * GenUIImageGallery — zero-dependency image gallery with optional lightbox.
 *
 * Registered as "genui-image-gallery" in GenUIRegistry.
 *
 * @example (AIChunk)
 * ```json
 * { "type": "ui", "component": "genui-image-gallery", "props": {
 *   "columns": 3,
 *   "images": [
 *     { "src": "https://example.com/a.jpg", "alt": "Photo A", "caption": "Morning" },
 *     { "src": "https://example.com/b.jpg", "alt": "Photo B" }
 *   ]
 * }}
 * ```
 */
@customElement("genui-image-gallery")
export class GenUIImageGallery extends ChativaElement {
  static override styles = css`
    :host {
      display: block;
    }

    .gallery {
      display: grid;
      gap: 6px;
    }

    .thumb-wrap {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .thumb {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: 8px;
      cursor: pointer;
      background: #e2e8f0;
    }

    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.2s;
    }

    .thumb:hover img {
      transform: scale(1.05);
    }

    .caption {
      font-size: 0.68rem;
      color: #64748b;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Lightbox */
    .lightbox {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.88);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }

    .lightbox-img {
      max-width: 90vw;
      max-height: 85vh;
      border-radius: 8px;
      object-fit: contain;
      user-select: none;
    }

    .lightbox-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      color: white;
      font-size: 2rem;
      line-height: 1;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: background 0.15s;
    }

    .lightbox-close:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .lightbox-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: white;
      font-size: 1.25rem;
      padding: 10px 14px;
      cursor: pointer;
      border-radius: 50%;
      transition: background 0.15s;
      line-height: 1;
    }

    .lightbox-nav:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .lightbox-nav.prev {
      left: 16px;
    }

    .lightbox-nav.next {
      right: 16px;
    }

    .lightbox-caption {
      position: absolute;
      bottom: 16px;
      left: 0;
      right: 0;
      text-align: center;
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.875rem;
      pointer-events: none;
    }
  `;

  /** Array of image objects to display. */
  @property({ type: Array }) images?: GenUIImage[];
  /** Number of grid columns. Default: 2. */
  @property({ type: Number }) columns?: number;

  /** Injected by GenUIMessage for event dispatch. */
  sendEvent?: GenUIComponentAPI["sendEvent"];

  @state() private _lightboxIndex: number | null = null;

  private _open(i: number) {
    this._lightboxIndex = i;
  }

  private _close() {
    this._lightboxIndex = null;
  }

  private _prev() {
    if (this._lightboxIndex === null) return;
    const len = this.images?.length ?? 0;
    this._lightboxIndex = (this._lightboxIndex - 1 + len) % len;
  }

  private _next() {
    if (this._lightboxIndex === null) return;
    const len = this.images?.length ?? 0;
    this._lightboxIndex = (this._lightboxIndex + 1) % len;
  }

  _onKeydown(e: KeyboardEvent) {
    if (this._lightboxIndex === null) return;
    if (e.key === "Escape") this._close();
    else if (e.key === "ArrowLeft") this._prev();
    else if (e.key === "ArrowRight") this._next();
  }

  override connectedCallback() {
    super.connectedCallback();
    this._boundKeydown = this._onKeydown.bind(this);
    window.addEventListener("keydown", this._boundKeydown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this._boundKeydown) window.removeEventListener("keydown", this._boundKeydown);
  }

  private _boundKeydown?: (e: KeyboardEvent) => void;

  override render() {
    const images = this.images ?? [];
    const cols = this.columns ?? 2;

    return html`
      <div class="gallery" style="grid-template-columns: repeat(${cols}, 1fr);">
        ${images.map((img, i) => html`
          <div class="thumb-wrap">
            <div
              class="thumb"
              @click=${() => this._open(i)}
              role="button"
              tabindex="0"
              aria-label="${img.alt ?? img.caption ?? `Image ${i + 1}`}"
              @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") this._open(i); }}
            >
              <img src="${img.src}" alt="${img.alt ?? ""}" loading="lazy" />
            </div>
            ${img.caption ? html`<span class="caption">${img.caption}</span>` : nothing}
          </div>
        `)}
      </div>

      ${this._lightboxIndex !== null ? this._renderLightbox(images) : nothing}
    `;
  }

  private _renderLightbox(images: GenUIImage[]) {
    const i = this._lightboxIndex!;
    const img = images[i];
    if (!img) return nothing;
    return html`
      <div
        class="lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="Image lightbox"
        @click=${(e: Event) => { if (e.target === e.currentTarget) this._close(); }}
      >
        <button class="lightbox-close" aria-label="Close lightbox" @click=${this._close}>×</button>
        ${images.length > 1 ? html`
          <button class="lightbox-nav prev" aria-label="Previous image" @click=${this._prev}>‹</button>
          <button class="lightbox-nav next" aria-label="Next image" @click=${this._next}>›</button>
        ` : nothing}
        <img class="lightbox-img" src="${img.src}" alt="${img.alt ?? ""}" />
        ${img.caption ? html`<div class="lightbox-caption">${img.caption}</div>` : nothing}
      </div>
    `;
  }
}
