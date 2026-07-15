import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  domain?: string;
}

export type LinkMetadataFetcher = (url: string) => Promise<LinkMetadata>;
export type PreviewVariant = "compact" | "expanded";

const cache = new Map<string, LinkMetadata>();

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getFaviconUrl(url: string): string {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return "";
  }
}

@customElement("link-preview-card")
export class LinkPreviewCard extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    :host([variant="compact"]) {
      max-width: 320px;
    }

    :host([variant="expanded"]) {
      max-width: 100%;
    }

    a {
      display: flex;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      background: #ffffff;
      transition: box-shadow 0.2s, transform 0.15s;
    }

    :host([variant="compact"]) a {
      flex-direction: row;
    }

    :host([variant="expanded"]) a {
      flex-direction: row;
    }

    a:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-1px);
    }

    .preview-image {
      object-fit: cover;
      flex-shrink: 0;
      background: #f1f5f9;
    }

    :host([variant="compact"]) .preview-image {
      width: 80px;
      min-height: 80px;
    }

    :host([variant="expanded"]) .preview-image {
      width: 120px;
      min-height: 120px;
    }

    .preview-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }

    :host([variant="compact"]) .preview-body {
      padding: 10px 12px;
    }

    :host([variant="expanded"]) .preview-body {
      padding: 12px 16px;
    }

    .preview-domain {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #64748b;
    }

    :host([variant="compact"]) .preview-domain {
      font-size: 0.7rem;
    }

    :host([variant="expanded"]) .preview-domain {
      font-size: 0.75rem;
    }

    .preview-domain img {
      border-radius: 3px;
    }

    :host([variant="compact"]) .preview-domain img {
      width: 14px;
      height: 14px;
    }

    :host([variant="expanded"]) .preview-domain img {
      width: 16px;
      height: 16px;
    }

    .preview-title {
      font-weight: 600;
      color: #1e293b;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    :host([variant="compact"]) .preview-title {
      font-size: 0.8rem;
      -webkit-line-clamp: 2;
    }

    :host([variant="expanded"]) .preview-title {
      font-size: 0.9rem;
      -webkit-line-clamp: 2;
    }

    .preview-desc {
      color: #64748b;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    :host([variant="compact"]) .preview-desc {
      font-size: 0.72rem;
      -webkit-line-clamp: 2;
    }

    :host([variant="expanded"]) .preview-desc {
      font-size: 0.8rem;
      -webkit-line-clamp: 3;
    }

    .preview-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #94a3b8;
    }

    :host([variant="compact"]) .preview-loading {
      padding: 12px 14px;
      font-size: 0.75rem;
    }

    :host([variant="expanded"]) .preview-loading {
      padding: 16px 18px;
      font-size: 0.8rem;
    }

    .preview-loading .spinner {
      border: 2px solid #e2e8f0;
      border-top-color: #94a3b8;
      border-radius: 50%;
      animation: link-preview-spin 0.8s linear infinite;
    }

    :host([variant="compact"]) .preview-loading .spinner {
      width: 14px;
      height: 14px;
    }

    :host([variant="expanded"]) .preview-loading .spinner {
      width: 18px;
      height: 18px;
    }

    @keyframes link-preview-spin {
      to { transform: rotate(360deg); }
    }

    .preview-fallback {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #4f46e5;
    }

    :host([variant="compact"]) .preview-fallback {
      padding: 10px 12px;
      font-size: 0.78rem;
    }

    :host([variant="expanded"]) .preview-fallback {
      padding: 14px 16px;
      font-size: 0.85rem;
    }

    .preview-fallback img {
      border-radius: 3px;
    }

    :host([variant="compact"]) .preview-fallback img {
      width: 14px;
      height: 14px;
    }

    :host([variant="expanded"]) .preview-fallback img {
      width: 18px;
      height: 18px;
    }

    .preview-fallback .link-icon {
      flex-shrink: 0;
    }

    :host([variant="compact"]) .preview-fallback .link-icon {
      width: 16px;
      height: 16px;
    }

    :host([variant="expanded"]) .preview-fallback .link-icon {
      width: 20px;
      height: 20px;
    }
  `;

  @property({ type: String }) url = "";
  @property({ type: String, reflect: true }) variant: PreviewVariant = "compact";
  @property({ type: Function }) metadataFetcher: LinkMetadataFetcher | null = null;

  @state() private _metadata: LinkMetadata | null = null;
  @state() private _loading = false;
  @state() private _error = false;

  override connectedCallback() {
    super.connectedCallback();
    this._fetchMetadata();
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("url") && changed.get("url") !== undefined) {
      this._fetchMetadata();
    }
  }

  private async _fetchMetadata() {
    if (!this.url) return;

    if (cache.has(this.url)) {
      this._metadata = cache.get(this.url)!;
      return;
    }

    const fetcher = this.metadataFetcher ?? (window as unknown as Record<string, unknown>).chativaMetadataFetcher as LinkMetadataFetcher | undefined;

    if (!fetcher) {
      this._error = true;
      return;
    }

    this._loading = true;
    try {
      const meta = await fetcher(this.url);
      cache.set(this.url, meta);
      this._metadata = meta;
    } catch {
      this._error = true;
    } finally {
      this._loading = false;
    }
  }

  private _renderLoading() {
    return html`
      <a href=${this.url} target="_blank" rel="noopener noreferrer">
        <div class="preview-loading">
          <div class="spinner"></div>
          <span>${extractDomain(this.url)}</span>
        </div>
      </a>
    `;
  }

  private _renderFallback() {
    const domain = extractDomain(this.url);
    const favicon = getFaviconUrl(this.url);
    return html`
      <a href=${this.url} target="_blank" rel="noopener noreferrer">
        <div class="preview-fallback">
          <svg class="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          ${favicon ? html`<img src=${favicon} alt="" />` : nothing}
          <span>${domain}</span>
        </div>
      </a>
    `;
  }

  private _renderPreview(meta: LinkMetadata) {
    const domain = meta.domain ?? extractDomain(this.url);
    const favicon = meta.favicon ?? getFaviconUrl(this.url);
    return html`
      <a href=${this.url} target="_blank" rel="noopener noreferrer">
        ${meta.image
          ? html`<img class="preview-image" src=${meta.image} alt="" loading="lazy" />`
          : nothing}
        <div class="preview-body">
          <div class="preview-domain">
            ${favicon ? html`<img src=${favicon} alt="" />` : nothing}
            <span>${domain}</span>
          </div>
          ${meta.title
            ? html`<div class="preview-title">${meta.title}</div>`
            : nothing}
          ${meta.description
            ? html`<div class="preview-desc">${meta.description}</div>`
            : nothing}
        </div>
      </a>
    `;
  }

  render() {
    if (this._loading) return this._renderLoading();
    if (this._metadata) return this._renderPreview(this._metadata);
    if (this._error) return this._renderFallback();
    return this._renderFallback();
  }
}
