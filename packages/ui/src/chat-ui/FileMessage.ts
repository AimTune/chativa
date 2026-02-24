import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { MessageTypeRegistry, type MessageSender } from "@chativa/core";

/**
 * File attachment message component.
 * Renders a downloadable file card with file type icon, name and size.
 *
 * Register a message of type "file" with:
 *   { url: "https://...", name: "report.pdf", size?: 2048000, mimeType?: "application/pdf" }
 */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function fileIconAndColor(mimeType: string, name: string): { icon: string; color: string; bg: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const mime = mimeType.toLowerCase();

  if (mime.includes("pdf") || ext === "pdf")
    return { icon: "pdf", color: "#dc2626", bg: "#fef2f2" };
  if (mime.includes("image") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
    return { icon: "image", color: "#0284c7", bg: "#f0f9ff" };
  if (mime.includes("video") || ["mp4", "webm", "mov", "avi"].includes(ext))
    return { icon: "video", color: "#7c3aed", bg: "#f5f3ff" };
  if (mime.includes("audio") || ["mp3", "wav", "ogg", "m4a"].includes(ext))
    return { icon: "audio", color: "#db2777", bg: "#fdf2f8" };
  if (mime.includes("zip") || mime.includes("archive") || ["zip", "rar", "7z", "tar", "gz"].includes(ext))
    return { icon: "zip", color: "#ea580c", bg: "#fff7ed" };
  if (mime.includes("spreadsheet") || mime.includes("excel") || ["xls", "xlsx", "csv"].includes(ext))
    return { icon: "sheet", color: "#16a34a", bg: "#f0fdf4" };
  if (mime.includes("presentation") || mime.includes("powerpoint") || ["ppt", "pptx"].includes(ext))
    return { icon: "slide", color: "#ea580c", bg: "#fff7ed" };
  if (mime.includes("word") || mime.includes("document") || ["doc", "docx"].includes(ext))
    return { icon: "doc", color: "#0284c7", bg: "#f0f9ff" };
  return { icon: "file", color: "#64748b", bg: "#f8fafc" };
}

function renderFileIcon(icon: string, color: string) {
  // All icons are simple SVG shapes
  const icons: Record<string, string> = {
    pdf: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-4-8H9v-1h5v1zm0 2H9v-1h5v1zm-2 2H9v-1h3v1z" fill="${color}"/>`,
    image: `<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="${color}"/>`,
    video: `<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" fill="${color}"/>`,
    audio: `<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="${color}"/>`,
    zip: `<path d="M20 6h-2.18c.07-.33.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.11.67.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2l8-5 8 5v2zm0-4.5l-8-5-8 5V8h3v1h2V8h2v1h2V8h3v6.5z" fill="${color}"/>`,
    sheet: `<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" fill="${color}"/>`,
    slide: `<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" fill="${color}"/>`,
    doc: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="${color}"/>`,
    file: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" fill="${color}"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">${icons[icon] ?? icons.file}</svg>`;
}

@customElement("file-message")
export class FileMessage extends LitElement {
  static override styles = css`
    :host { display: block; }

    .message {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      max-width: 82%;
      margin-bottom: 2px;
    }

    .message.bot { margin-right: auto; }
    .message.user { margin-left: auto; flex-direction: row-reverse; }

    .avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #ede9fe;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .avatar.hidden { visibility: hidden; }
    .avatar svg { width: 16px; height: 16px; color: #7c3aed; }

    .content {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .file-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      text-decoration: none;
      min-width: 200px;
      max-width: 260px;
      transition: background 0.15s, border-color 0.15s;
      cursor: pointer;
    }

    .file-card:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .file-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .file-info {
      flex: 1;
      min-width: 0;
    }

    .file-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }

    .file-meta {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .download-icon {
      flex-shrink: 0;
      color: #94a3b8;
    }

    .time {
      font-size: 0.6875rem;
      color: #94a3b8;
      padding: 0 4px;
    }
  `;

  @property({ type: Object }) messageData: Record<string, unknown> = {};
  @property({ type: String }) sender: MessageSender = "bot";
  @property({ type: Number }) timestamp = 0;
  @property({ type: Boolean }) hideAvatar = false;

  private get _time(): string {
    if (!this.timestamp) return "";
    return new Date(this.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  render() {
    const isUser = this.sender === "user";
    const url = String(this.messageData?.url ?? "#");
    const name = String(this.messageData?.name ?? "file");
    const size = this.messageData?.size as number | undefined;
    const mimeType = String(this.messageData?.mimeType ?? "");

    const { icon, color, bg } = fileIconAndColor(mimeType, name);

    return html`
      <div class="message ${isUser ? "user" : "bot"}">
        ${!isUser
          ? html`
              <div class="avatar ${this.hideAvatar ? "hidden" : ""}">
                <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="8" width="14" height="12" rx="2.5" />
                  <circle cx="9.5" cy="13" r="1.5" fill="white" />
                  <circle cx="14.5" cy="13" r="1.5" fill="white" />
                  <path d="M9.5 17c.5.5 1.4.8 2.5.8s2-.3 2.5-.8" stroke="white" stroke-width="1.2" stroke-linecap="round" fill="none" />
                </svg>
              </div>
            `
          : nothing}
        <div class="content">
          <a class="file-card" href="${url}" download="${name}" target="_blank" rel="noopener">
            <div class="file-icon" style="background: ${bg}">
              <div .innerHTML=${renderFileIcon(icon, color)}></div>
            </div>
            <div class="file-info">
              <div class="file-name" title="${name}">${name}</div>
              <div class="file-meta">${size ? formatBytes(size) : "Download"}</div>
            </div>
            <svg class="download-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
          </a>
          ${this._time ? html`<span class="time">${this._time}</span>` : nothing}
        </div>
      </div>
    `;
  }
}

MessageTypeRegistry.register(
  "file",
  FileMessage as unknown as typeof HTMLElement
);

export default FileMessage;
