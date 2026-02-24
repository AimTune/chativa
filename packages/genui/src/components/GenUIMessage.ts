import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { GenUIStreamState, AIChunk, AIChunkText, AIChunkUI, AIChunkEvent } from "@chativa/core";
import { MessageTypeRegistry } from "@chativa/core";
import { GenUIRegistry } from "../registry/GenUIRegistry";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventListener {
  targetId?: number;
  cb: (payload: unknown) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

@customElement("genui-message")
export class GenUIMessage extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .genui-wrapper {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 4px 0;
    }

    .chunk-enter {
      animation: chunkFadeIn 0.35s ease-out both;
    }

    @keyframes chunkFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .typing-dots {
      display: flex;
      gap: 4px;
      padding: 6px 2px;
      align-items: center;
    }

    .typing-dots span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #94a3b8;
      animation: dotBounce 1.2s infinite ease-in-out;
    }

    .typing-dots span:nth-child(2) { animation-delay: 0.15s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.30s; }

    @keyframes dotBounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
      40%            { transform: translateY(-5px); opacity: 1; }
    }

    .error-fallback {
      padding: 10px 14px;
      border: 1px dashed #f87171;
      border-radius: 8px;
      color: #ef4444;
      font-size: 0.8125rem;
      font-family: inherit;
    }

    .unknown-fallback {
      padding: 10px 14px;
      border: 1px dashed #fb923c;
      border-radius: 8px;
      color: #ea580c;
      font-size: 0.8125rem;
      font-family: inherit;
    }
  `;

  // ── Props passed by ChatMessageList ───────────────────────────────────────

  @property({ type: Object }) messageData: Record<string, unknown> = {};
  @property({ type: String }) sender = "bot";
  @property({ type: String }) messageId = "";
  @property({ type: Number }) timestamp = 0;
  @property({ type: Boolean }) hideAvatar = false;
  @property({ type: String }) status = "sent";

  // ── Internal state ────────────────────────────────────────────────────────

  /** Cached component instances keyed by AIChunkUI.id */
  private _instances = new Map<number, HTMLElement>();

  /**
   * Per-message event bus.
   * Key: event name. Value: set of listeners with optional targetId.
   */
  private _listeners = new Map<string, Set<EventListener>>();

  /** Track which event chunk ids have already been dispatched. */
  private _dispatchedEvents = new Set<number>();

  // ── Event bus API (injected into child components) ────────────────────────

  private _sendEvent = (type: string, payload: unknown, sourceId?: number): void => {
    // 1. Deliver to internal listeners within this message (e.g. form_success → form component)
    const listeners = this._listeners.get(type);
    if (listeners) {
      listeners.forEach(({ targetId, cb }) => {
        if (targetId === undefined || targetId === sourceId) {
          cb(payload);
        }
      });
    }
    // 2. Bubble up to ChatWidget so it can be forwarded to the connector
    this.dispatchEvent(
      new CustomEvent("genui-send-event", {
        detail: { msgId: this.messageId, eventType: type, payload, sourceId },
        bubbles: true,
        composed: true,
      })
    );
  };

  private _listenEvent = (type: string, cb: (p: unknown) => void, targetId?: number): void => {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add({ targetId, cb });
  };

  // ── Chunk rendering ───────────────────────────────────────────────────────

  private _renderTextChunk(chunk: AIChunkText) {
    // Inline markdown rendering without depending on marked at runtime in genui.
    // We use unsafeHTML only if the content contains markdown markers.
    const raw = chunk.content;
    return html`
      <div class="chunk-enter" style="font-size:0.875rem;line-height:1.6;color:#0f172a;white-space:pre-wrap;">
        ${raw}
      </div>
    `;
  }

  private _renderUIChunk(chunk: AIChunkUI) {
    const entry = GenUIRegistry.resolve(chunk.component);

    if (!entry) {
      return html`
        <div class="unknown-fallback chunk-enter">
          <strong>Unknown component:</strong> "${chunk.component}"
        </div>
      `;
    }

    // Schema validation (optional)
    if (entry.schema) {
      const result = entry.schema.safeParse(chunk.props);
      if (!result.success) {
        console.error(`[GenUI] Prop validation failed for "${chunk.component}":`, result.error);
        return html`
          <div class="error-fallback chunk-enter">
            <strong>Invalid props</strong> for "${chunk.component}" — see console for details.
          </div>
        `;
      }
    }

    // Retrieve or create the element instance
    let el = this._instances.get(chunk.id);
    if (!el) {
      el = new entry.component() as HTMLElement;
      this._instances.set(chunk.id, el);

      // Inject scoped event API
      const elAny = el as unknown as Record<string, unknown>;
      elAny["sendEvent"] = (type: string, payload: unknown) =>
        this._sendEvent(type, payload, chunk.id);
      elAny["listenEvent"] = (type: string, cb: (p: unknown) => void) =>
        this._listenEvent(type, cb, chunk.id);
    }

    // Always sync latest props
    Object.assign(el, chunk.props);

    return html`<div class="chunk-enter">${el}</div>`;
  }

  // ── Dispatch pending event chunks ─────────────────────────────────────────

  private _dispatchEventChunks(chunks: AIChunkEvent[]): void {
    for (const chunk of chunks) {
      if (this._dispatchedEvents.has(chunk.id)) continue;
      this._dispatchedEvents.add(chunk.id);

      const listeners = this._listeners.get(chunk.name);
      if (!listeners) continue;

      listeners.forEach(({ targetId, cb }) => {
        const matches = chunk.for === undefined || targetId === undefined || targetId === chunk.for;
        if (matches) cb(chunk.payload);
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  override render() {
    const state = this.messageData as unknown as GenUIStreamState;
    const chunks = state?.chunks ?? [];
    const streamingComplete = state?.streamingComplete ?? false;

    // Separate event chunks and dispatch them as side-effects during render
    const eventChunks = chunks.filter((c: AIChunk): c is AIChunkEvent => c.type === "event");
    this._dispatchEventChunks(eventChunks);

    const visibleChunks = chunks.filter(
      (c: AIChunk): c is AIChunkText | AIChunkUI => c.type !== "event"
    );

    // Don't show typing dots when the bot is waiting for user interaction
    // (i.e. the last visible chunk is a UI component like a form or card).
    const lastChunk = visibleChunks[visibleChunks.length - 1];
    const showTypingDots = !streamingComplete && (!lastChunk || lastChunk.type !== "ui");

    return html`
      <div class="genui-wrapper">
        ${visibleChunks.map((chunk: AIChunkText | AIChunkUI) => {
      if (chunk.type === "text") return this._renderTextChunk(chunk);
      if (chunk.type === "ui") return this._renderUIChunk(chunk);
      return nothing;
    })}
        ${showTypingDots ? html`
          <div class="typing-dots">
            <span></span><span></span><span></span>
          </div>
        ` : nothing}
      </div>
    `;
  }
}

// ── Register with MessageTypeRegistry ─────────────────────────────────────────
// This side-effect runs when the module is first imported.
try {
  MessageTypeRegistry.register("genui", GenUIMessage as unknown as typeof HTMLElement);
} catch {
  // Already registered (e.g. HMR reload) — no-op
}
