import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
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

  // ── Focus management ─────────────────────────────────────────────────

  protected override updated(changed: Map<PropertyKey, unknown>) {
    super.updated?.(changed);
    // Focus the textarea only when the widget transitions from closed → open
    const isOpened = this.themeState.isOpened;
    if (isOpened && !this._wasOpened) {
      this.updateComplete.then(() => {
        const input = this.shadowRoot
          ?.querySelector("chat-input")
          ?.shadowRoot?.querySelector<HTMLElement>(".text-input");
        input?.focus();
      });
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
      <div class="${cls}" role="dialog" aria-modal="true" aria-label="${t("widget.title")}" style="${this._positionStyle}">
        <chat-header></chat-header>
        <chat-message-list></chat-message-list>
        <chat-input @send-message=${this.handleSendMessage.bind(this)}></chat-input>
      </div>
    `;
  }

}

export default ChatWidget;
