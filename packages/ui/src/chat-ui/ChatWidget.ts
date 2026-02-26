import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "i18next";
import {
  ChatEngine,
  ConnectorRegistry,
  MessageTypeRegistry,
  messageStore,
  createOutgoingMessage,
} from "@chativa/core";
import { ChatbotMixin } from "../mixins/ChatbotMixin";
import { registerCommand } from "../commands/index";

import "./DefaultTextMessage";
import "./QuickReplyMessage";
import "./ImageMessage";
import "./CardMessage";
import "./ButtonsMessage";
import "./FileMessage";
import "./VideoMessage";
import "./CarouselMessage";
import "./ChatInput";
import "./ChatMessageList";
import "./ChatHeader";
MessageTypeRegistry.setFallback(
  customElements.get("default-text-message") as unknown as typeof HTMLElement
);

const SIZE_PX: Record<string, number> = { small: 44, medium: 56, large: 68 };

@customElement("chat-iva")
export class ChatWidget extends ChatbotMixin(LitElement) {
  static override styles = css`
    :host {
      display: block;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(18px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .widget {
      position: fixed;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.14), 0 6px 20px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      animation: slideUp 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      transition: border-radius 0.25s ease, box-shadow 0.25s ease;
    }

    .widget.fullscreen {
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      border-radius: 0 !important;
      animation: fadeIn 0.2s ease;
    }

    /* Applied directly via JS — no transition during drag */
    .widget.dragging {
      transition: none !important;
      animation: none !important;
      user-select: none;
      cursor: grabbing;
    }

    @media (max-width: 480px) {
      .widget {
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        border-radius: 0 !important;
        animation: fadeIn 0.18s ease;
      }
    }

    /* ── File drop overlay ─────────────────────────────────── */
    .drop-overlay {
      position: absolute;
      inset: 0;
      background: rgba(79, 70, 229, 0.07);
      border: 2.5px dashed rgba(79, 70, 229, 0.45);
      border-radius: inherit;
      z-index: 200;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      pointer-events: none;
      backdrop-filter: blur(1px);
      animation: fadeIn 0.12s ease;
    }

    .drop-overlay-icon {
      color: var(--chativa-primary-color, #4f46e5);
      opacity: 0.85;
    }

    .drop-overlay-label {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--chativa-primary-color, #4f46e5);
      letter-spacing: -0.01em;
    }

    .drop-overlay-sub {
      font-size: 0.8125rem;
      color: rgba(79, 70, 229, 0.65);
    }
  `;

  @property({ type: String }) connector = "dummy";

  /**
   * Set as HTML attribute to start in fullscreen and hide the toggle:
   *   <chat-iva fullscreen-only></chat-iva>
   * Equivalent to: setFullscreen(true) + setAllowFullscreen(false)
   */
  @property({ type: Boolean, attribute: "fullscreen-only" })
  get fulllscreenOnly(): boolean { return false; }
  set fulllscreenOnly(_v: boolean) {
    this.themeState.setFullscreen(true);
    this.themeState.setAllowFullscreen(false);
  }

  // ── File-drop overlay ────────────────────────────────────────────────

  @state() private _showDropOverlay = false;
  /** Depth counter to handle dragenter/dragleave firing over child elements. */
  private _dropDepth = 0;

  // ── Drag state — NOT @state to avoid per-frame re-renders ────────────

  /** Last stable drag position (used in _positionStyle). Triggers a render only at drag start/end. */
  private _dragPos: { left: number; top: number } | null = null;
  private _wasOpened = false;

  private _dragAnchor: {
    mouseX: number;
    mouseY: number;
    widgetLeft: number;
    widgetTop: number;
  } | null = null;

  // ── Lifecycle ────────────────────────────────────────────────────────

  private _unsubscribeMessages!: () => void;
  private _engine!: ChatEngine;

  connectedCallback() {
    super.connectedCallback();

    // Register built-in slash commands with inline translations
    registerCommand({
      name: "clear",
      translations: {
        en: { description: "Clear all messages from the chat" },
        tr: { description: "Tüm mesajları temizle" },
      },
      execute() {
        messageStore.getState().clear();
      },
    });

    const adapter = ConnectorRegistry.get(this.connector);
    this._engine = new ChatEngine(adapter);
    this._engine.init().catch((err: unknown) => {
      console.error("[ChatWidget] Engine init failed:", err);
    });
    this._unsubscribeMessages = messageStore.subscribe(() => this.requestUpdate());
    document.addEventListener("keydown", this._onKeyDown);
    this.addEventListener("chat-drag-start", this._onDragStart as EventListener);
    this.addEventListener("chat-action", this._onChatAction as EventListener);
    this.addEventListener("chat-retry", this._onChatRetry as EventListener);
    this.addEventListener("chativa-feedback", this._onFeedback as EventListener);
    this.addEventListener("send-file", this._onSendFile as EventListener);
    this.addEventListener("chat-load-history", this._onLoadHistory as EventListener);
    this.addEventListener("genui-send-event", this._onGenUISendEvent as EventListener);
  }

  disconnectedCallback() {
    this._unsubscribeMessages?.();
    this._engine?.destroy().catch(() => {});
    document.removeEventListener("keydown", this._onKeyDown);
    this.removeEventListener("chat-drag-start", this._onDragStart as EventListener);
    this.removeEventListener("chat-action", this._onChatAction as EventListener);
    this.removeEventListener("chat-retry", this._onChatRetry as EventListener);
    this.removeEventListener("chativa-feedback", this._onFeedback as EventListener);
    this.removeEventListener("send-file", this._onSendFile as EventListener);
    this.removeEventListener("chat-load-history", this._onLoadHistory as EventListener);
    this.removeEventListener("genui-send-event", this._onGenUISendEvent as EventListener);
    this._detachDragListeners();
    super.disconnectedCallback();
  }

  // ── Drag handling — direct DOM, zero re-renders during drag ──────────

  private _onDragStart = (e: CustomEvent<{ clientX: number; clientY: number }>) => {
    if (this.themeState.isFullscreen) return;

    const widget = this._widget;
    if (!widget) return;

    const rect = widget.getBoundingClientRect();

    // Store anchor in current left/top coordinates
    this._dragAnchor = {
      mouseX: e.detail.clientX,
      mouseY: e.detail.clientY,
      widgetLeft: rect.left,
      widgetTop: rect.top,
    };

    // Switch from corner-based to left/top positioning (ONE re-render)
    this._dragPos = { left: rect.left, top: rect.top };
    this.requestUpdate();

    // Add dragging class directly — no re-render needed
    this.updateComplete.then(() => {
      this._widget?.classList.add("dragging");
    });

    document.addEventListener("mousemove", this._onMouseMove);
    document.addEventListener("mouseup", this._onMouseUp);
    document.addEventListener("touchmove", this._onTouchMove, { passive: false });
    document.addEventListener("touchend", this._onMouseUp);
  };

  private _onMouseMove = (e: MouseEvent) => this._applyDrag(e.clientX, e.clientY);

  private _onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    this._applyDrag(e.touches[0].clientX, e.touches[0].clientY);
  };

  private _applyDrag(clientX: number, clientY: number) {
    if (!this._dragAnchor) return;

    const dx = clientX - this._dragAnchor.mouseX;
    const dy = clientY - this._dragAnchor.mouseY;

    const { layout } = this.theme;
    const w = parseInt(layout?.width ?? "360", 10) || 360;
    const h = parseInt(layout?.height ?? "520", 10) || 520;

    const left = Math.min(Math.max(this._dragAnchor.widgetLeft + dx, -w + 80), window.innerWidth - 80);
    const top  = Math.min(Math.max(this._dragAnchor.widgetTop  + dy, 0), window.innerHeight - Math.min(h, 80));

    // Direct DOM update — NO Lit re-render triggered
    const widget = this._widget;
    if (widget) {
      widget.style.left = `${left}px`;
      widget.style.top  = `${top}px`;
    }
    // Keep in sync so _onMouseUp gets the final value cheaply
    this._dragPos = { left, top };
  }

  private _onMouseUp = () => {
    // Remove dragging class directly — no re-render
    this._widget?.classList.remove("dragging");
    this._dragAnchor = null;
    this._detachDragListeners();
    // ONE re-render to bake final position into template style binding
    this.requestUpdate();
  };

  private _detachDragListeners() {
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("mouseup", this._onMouseUp);
    document.removeEventListener("touchmove", this._onTouchMove);
    document.removeEventListener("touchend", this._onMouseUp);
  }

  private get _widget(): HTMLElement | null {
    return this.shadowRoot?.querySelector<HTMLElement>(".widget") ?? null;
  }

  // ── Message sending ──────────────────────────────────────────────────

  private handleSendMessage(e: CustomEvent<string>) {
    const text = e.detail?.trim();
    if (!text) return;
    this._engine
      .send(createOutgoingMessage(text))
      .catch((err: unknown) => console.error("[ChatWidget] Send failed:", err));
  }

  private _onChatAction = (e: Event) => {
    const text = (e as CustomEvent<string>).detail?.trim();
    if (!text) return;
    this._engine
      .send(createOutgoingMessage(text))
      .catch((err: unknown) => console.error("[ChatWidget] Action send failed:", err));
  };

  private _onFeedback = (e: CustomEvent<{ messageId: string; feedback: "like" | "dislike" }>) => {
    this._engine
      .sendFeedback(e.detail.messageId, e.detail.feedback)
      .catch((err: unknown) => console.error("[ChatWidget] Feedback failed:", err));
  };

  private _onChatRetry = () => {
    this._engine.init().catch((err: unknown) =>
      console.error("[ChatWidget] Reconnect failed:", err)
    );
  };

  private _onSendFile = (e: CustomEvent<{ files: File[]; text: string }>) => {
    const { files, text } = e.detail;
    for (const file of files) {
      this._engine.sendFile(file, text ? { caption: text } : undefined)
        .catch((err: unknown) => console.error("[ChatWidget] sendFile failed:", err));
    }
  };

  private _onLoadHistory = () => {
    this._engine.loadHistory()
      .catch((err: unknown) => console.error("[ChatWidget] loadHistory failed:", err));
  };

  private _onGenUISendEvent = (e: CustomEvent<{ msgId: string; eventType: string; payload: unknown }>) => {
    this._engine.receiveComponentEvent(e.detail.msgId, e.detail.eventType, e.detail.payload);
  };

  // ── Widget-level file drop ────────────────────────────────────────────

  private _onFileDragEnter = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    this._dropDepth++;
    this._showDropOverlay = true;
  };

  private _onFileDragOver = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
  };

  private _onFileDragLeave = () => {
    this._dropDepth--;
    if (this._dropDepth <= 0) {
      this._dropDepth = 0;
      this._showDropOverlay = false;
    }
  };

  private _onFileDrop = (e: DragEvent) => {
    e.preventDefault();
    this._dropDepth = 0;
    this._showDropOverlay = false;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    // Forward files to ChatInput queue so the user can optionally add a caption
    const chatInput = this.shadowRoot?.querySelector("chat-input") as (Element & { addFiles(f: File[]): void }) | null;
    chatInput?.addFiles(files);
  };

  // ── Accessibility: focus trap + ESC to close ─────────────────────────

  /** Element focused before the dialog opened — restored when it closes. */
  private _prevActiveElement: HTMLElement | null = null;

  /**
   * Walk the composed shadow tree and collect all focusable elements in DOM
   * order. Needed because querySelectorAll does not pierce shadow roots.
   */
  private _getFocusable(): HTMLElement[] {
    const SELECTOR =
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const result: HTMLElement[] = [];
    const collect = (root: ShadowRoot | Element) => {
      for (const el of root.querySelectorAll<HTMLElement>("*")) {
        if ((el as HTMLElement).matches?.(SELECTOR)) result.push(el);
        if (el.shadowRoot) collect(el.shadowRoot);
      }
    };
    if (this.shadowRoot) collect(this.shadowRoot);
    return result;
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (!this.themeState.isOpened) return;

    if (e.key === "Escape") {
      e.preventDefault();
      this.themeState.close();
      return;
    }

    if (e.key !== "Tab") return;

    const focusable = this._getFocusable();
    if (focusable.length === 0) return;

    // Resolve the deeply-nested active element across shadow roots
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }

    const idx = focusable.indexOf(active as HTMLElement);

    if (!e.shiftKey && (idx === -1 || idx >= focusable.length - 1)) {
      e.preventDefault();
      focusable[0].focus();
    } else if (e.shiftKey && idx <= 0) {
      e.preventDefault();
      focusable[focusable.length - 1].focus();
    }
  };

  // ── Focus management ─────────────────────────────────────────────────

  protected override updated(changed: Map<PropertyKey, unknown>) {
    super.updated?.(changed);
    const isOpened = this.themeState.isOpened;

    if (isOpened && !this._wasOpened) {
      // Store previously focused element so we can restore it on close
      this._prevActiveElement = document.activeElement as HTMLElement;
      this.updateComplete.then(() => {
        const input = this.shadowRoot
          ?.querySelector("chat-input")
          ?.shadowRoot?.querySelector<HTMLElement>(".text-input");
        input?.focus();
      });
    }

    if (!isOpened && this._wasOpened) {
      // Return focus to the element that was active before the dialog opened
      this._prevActiveElement?.focus();
      this._prevActiveElement = null;
    }

    this._wasOpened = isOpened;
  }

  // ── Positioning ──────────────────────────────────────────────────────

  private get _positionStyle(): string {
    const { isFullscreen } = this.themeState;
    if (isFullscreen) return "";

    const { positionMargin, layout, size, position } = this.theme;
    const w  = layout?.width  ?? "360px";
    const ht = layout?.height ?? "520px";

    if (this._dragPos) {
      return `left: ${this._dragPos.left}px; top: ${this._dragPos.top}px; width: ${w}; height: ${ht};`;
    }

    const m      = positionMargin ? `${Number(positionMargin) * 0.5 + 0.5}rem` : "1rem";
    const btnPx  = SIZE_PX[size ?? "medium"] ?? 56;
    const vOff   = `calc(${m} + ${btnPx}px + 12px)`;
    const [v, h] = (position ?? "bottom-right").split("-");
    return `${v}: ${vOff}; ${h}: ${m}; width: ${w}; height: ${ht};`;
  }

  // ── Render ───────────────────────────────────────────────────────────

  render() {
    if (!this.themeState.isOpened) return nothing;

    const cls = ["widget", this.themeState.isFullscreen ? "fullscreen" : ""]
      .filter(Boolean)
      .join(" ");

    return html`
      <div
        class="${cls}"
        role="dialog"
        aria-modal="true"
        aria-label="${t("widget.title")}"
        style="${this._positionStyle}"
        @dragenter=${this._onFileDragEnter}
        @dragover=${this._onFileDragOver}
        @dragleave=${this._onFileDragLeave}
        @drop=${this._onFileDrop}
      >
        <chat-header></chat-header>
        <chat-message-list></chat-message-list>
        <chat-input @send-message=${this.handleSendMessage.bind(this)}></chat-input>

        ${this._showDropOverlay ? html`
          <div class="drop-overlay" aria-hidden="true">
            <svg class="drop-overlay-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
            <span class="drop-overlay-label">${t("input.dropHere")}</span>
            <span class="drop-overlay-sub">${t("input.dropHereSubtitle")}</span>
          </div>
        ` : nothing}
      </div>
    `;
  }

}

export default ChatWidget;
