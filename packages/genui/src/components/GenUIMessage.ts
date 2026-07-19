import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { GenUIStreamState, AIChunk, AIChunkText, AIChunkUI, AIChunkEvent } from "@chativa/core";
import { ChativaElement, MessageTypeRegistry, chatStore, i18next, t } from "@chativa/core";
import { GenUIRegistry } from "../registry/GenUIRegistry";
import { bubbleStyles } from "../styles/bubble";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventListener {
  targetId?: number;
  cb: (payload: unknown) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

@customElement("genui-message")
export class GenUIMessage extends ChativaElement {
  static override styles = [bubbleStyles, css`
    :host {
      display: block;
      width: 100%;
    }

    /* Same row layout as the built-in message types so GenUI content
       lines up with regular bot bubbles (avatar gutter + 82% cap). */
    .message {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      max-width: 82%;
      margin-right: auto;
      margin-bottom: 2px;
    }

    .avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #ede9fe;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }

    .avatar.hidden { visibility: hidden; }

    .avatar svg {
      width: 16px;
      height: 16px;
      color: #7c3aed;
    }

    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex: 1;
      min-width: 0;
      /* Single inheritance point for the whole GenUI subtree — built-in and
         custom components pick this up unless they override it themselves. */
      font-family: var(--chativa-font-family, inherit);
    }

    /* Text chunks render as regular bot bubbles (shared chativa-bubble
       look from ../styles/bubble) so mixed text + component streams read
       like one conversation. */

    .genui-wrapper {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 4px 0;
      min-width: 0;
    }

    .chunk-enter {
      animation: chunkFadeIn 0.35s ease-out both;
      max-width: 100%;
      min-width: 0;
    }

    /* Custom components can declare any width — never let them push
       past the message column (widget viewport). */
    .chunk-enter > * {
      max-width: 100%;
      box-sizing: border-box;
    }

    .time {
      font-size: 0.6875rem;
      color: #94a3b8;
      padding: 0 2px;
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
  `];

  // ── Props passed by ChatMessageList ───────────────────────────────────────

  @property({ type: Object }) messageData: Record<string, unknown> = {};
  @property({ type: String }) sender = "bot";
  @property({ type: String }) messageId = "";
  @property({ type: Number }) timestamp = 0;
  @property({ type: Boolean }) hideAvatar = false;
  @property({ type: String }) status = "sent";
  /** Show developer diagnostics (e.g. the unknown-component fallback). Off in production. */
  @property({ type: Boolean }) debug = false;

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
    // NOTE: `${chunk.content}` must stay flush against the tags — the div is
    // white-space:pre-wrap, so template indentation would render literally
    // as leading spaces.
    return html`<div class="chunk-enter chativa-bubble">${chunk.content}</div>`;
  }

  private _renderUIChunk(chunk: AIChunkUI) {
    const entry = GenUIRegistry.resolve(chunk.component);

    if (!entry) {
      // An unregistered component is a development mistake, not something an end
      // user should see. Render nothing in production; surface the diagnostic
      // only when `debug` is on.
      if (!this.debug) return html``;
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

      // Inject scoped event + i18n API so custom components
      // don't need to depend on i18next directly.
      const elAny = el as unknown as Record<string, unknown>;
      elAny["sendEvent"] = (type: string, payload: unknown) =>
        this._sendEvent(type, payload, chunk.id);
      elAny["listenEvent"] = (type: string, cb: (p: unknown) => void) =>
        this._listenEvent(type, cb, chunk.id);
      elAny["tFn"] = (key: string, fallback?: string) =>
        t(key, { defaultValue: fallback ?? key });
      elAny["onLangChange"] = (cb: () => void) => {
        i18next.on("languageChanged", cb);
        return () => i18next.off("languageChanged", cb);
      };
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

  private get _time(): string {
    if (!this.timestamp) return "";
    return new Date(this.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private _renderAvatar(avatarUrl?: string) {
    return html`
      <div class="avatar ${this.hideAvatar ? "hidden" : ""}">
        ${avatarUrl
          ? html`<img src=${avatarUrl} alt="bot avatar" />`
          : html`
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="8" width="14" height="12" rx="2.5" />
                <circle cx="9.5" cy="13" r="1.5" fill="white" />
                <circle cx="14.5" cy="13" r="1.5" fill="white" />
                <path
                  d="M9.5 17c.5.5 1.4.8 2.5.8s2-.3 2.5-.8"
                  stroke="white"
                  stroke-width="1.2"
                  stroke-linecap="round"
                  fill="none"
                />
              </svg>
            `}
      </div>
    `;
  }

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

    const avatarCfg = chatStore.getState().theme.avatar;
    const showAvatar = avatarCfg?.showBot !== false;

    return html`
      <div class="message" role="article">
        ${showAvatar ? this._renderAvatar(avatarCfg?.bot) : nothing}
        <div class="content">
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
          ${this._time ? html`<span class="time" aria-hidden="true">${this._time}</span>` : nothing}
        </div>
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
