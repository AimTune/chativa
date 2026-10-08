import { LitElement, html, css, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import {
  t,
  EventBus,
  MessageActionRegistry,
  getLatestTurn,
  isReplyStreaming,
  resolveMessageActionLabel,
  type CapabilitySupport,
  type IMessageAction,
  type MessageActionContext,
  type MessageActionsConfig,
  type MessageActionSupport,
  type StoredMessage,
} from "@chativa/core";
import i18next from "../i18n/i18n";
import { copyText, markdownToPlainText } from "../utils/clipboard";

/** Which built-in actions a message shows. */
export interface BuiltInMessageActions {
  copy: boolean;
  regenerate: boolean;
  edit: boolean;
}

export interface MessageActionInputs {
  /** The whole transcript (not a search-filtered view) — the latest turn is computed from it. */
  messages: readonly StoredMessage[];
  config: MessageActionsConfig | undefined;
  support: MessageActionSupport;
  isTyping: boolean;
}

/**
 * Decide the built-in actions for one message.
 *
 * Copy: bot messages with non-empty text that finished streaming.
 * Regenerate: the last bubble of the latest bot reply. Edit: the latest user
 * text message. Both only when the connector supports the action (or the
 * `fallback` option emulates it), the backend has not denied it, and nothing
 * is still being produced.
 */
export function resolveBuiltInActions(
  msg: StoredMessage,
  { messages, config, support, isTyping }: MessageActionInputs,
): BuiltInMessageActions {
  const cfg = config ?? {};
  const allowed = (s: CapabilitySupport) =>
    s === "supported" || (s === "unsupported" && cfg.fallback === true);
  const isUser = msg.from === "user";
  const text = msg.data?.text;

  const copy =
    !isUser &&
    cfg.copy !== false &&
    typeof text === "string" &&
    text.trim() !== "" &&
    msg.data?.streaming !== true;

  const turn = getLatestTurn(messages);
  const settled = !isTyping && !isReplyStreaming(turn.reply);

  const regenerate =
    !isUser &&
    cfg.regenerate !== false &&
    allowed(support.regenerate) &&
    settled &&
    turn.userMessage !== undefined &&
    turn.reply[turn.reply.length - 1]?.id === msg.id;

  const edit =
    isUser &&
    cfg.edit !== false &&
    allowed(support.editMessage) &&
    settled &&
    msg.type === "text" &&
    turn.userMessage?.id === msg.id;

  return { copy, regenerate, edit };
}

const COPY_ICON = svg`<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>`;
const CHECK_ICON = svg`<path d="M5 12.5l4.5 4.5L19 7.5"/>`;
const REGENERATE_ICON = svg`<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>`;
const EDIT_ICON = svg`<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>`;

const MORE_ICON = svg`<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>`;

const COPIED_MS = 1500;

/**
 * The per-message action bar: copy, regenerate, edit and every applicable
 * action from `MessageActionRegistry`.
 *
 * Rendered by `chat-message-list` under messages, so message-type components
 * don't implement actions themselves. Which built-ins show is decided by the
 * list (see {@link resolveBuiltInActions}) and passed in.
 *
 * Dispatches (bubbling, composed):
 * - `chativa-regenerate` ({ messageId }) — ChatWidget / AgentPanel call `ChatEngine.regenerate`
 * - `chativa-edit-start` ({ messageId }) — the list opens its inline editor
 * Copy is handled here and reported on the EventBus as `message_copied`.
 */
@customElement("message-actions")
export class MessageActions extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .actions {
      display: flex;
      gap: 2px;
      padding: 0 2px;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 22px;
      background: none;
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 0 4px;
      cursor: pointer;
      font: inherit;
      font-size: 0.75rem;
      line-height: 1;
      color: #94a3b8;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }

    .action-btn:hover {
      border-color: #e2e8f0;
      background: #f8fafc;
      color: #64748b;
    }

    .action-btn:focus-visible {
      outline: 2px solid var(--chativa-primary-color, #4f46e5);
      outline-offset: 1px;
    }

    .action-btn.copied {
      color: var(--chativa-success-color, #16a34a);
    }

    .action-btn svg {
      width: 14px;
      height: 14px;
    }

    .action-glyph {
      font-size: 0.8125rem;
      line-height: 1;
    }

    /* "⋮" overflow menu for custom actions (placement: "menu") */
    .more {
      position: relative;
      display: inline-flex;
    }

    .menu {
      position: absolute;
      bottom: calc(100% + 4px);
      inset-inline-start: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      min-width: 160px;
      padding: 4px;
      background: var(--chativa-background-color, #ffffff);
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 7px 10px;
      border: none;
      border-radius: 6px;
      background: none;
      color: var(--chativa-text-color, #0f172a);
      font: inherit;
      font-size: 0.8125rem;
      text-align: start;
      white-space: nowrap;
      cursor: pointer;
    }

    .menu-item:hover,
    .menu-item:focus-visible {
      background: #f1f5f9;
      outline: none;
    }

    .menu-item svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .menu-icon {
      display: inline-flex;
      width: 16px;
      justify-content: center;
      flex-shrink: 0;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `;

  @property({ type: Object }) message: StoredMessage | null = null;
  /** Latest bot reply / latest user message — forwarded to custom actions. */
  @property({ type: Boolean }) isLatest = false;
  @property({ type: Object }) builtIns: BuiltInMessageActions = {
    copy: false,
    regenerate: false,
    edit: false,
  };
  /** Reflected while the "Copied" confirmation shows, so the host keeps the bar visible. */
  @property({ type: Boolean, reflect: true }) active = false;

  @state() private _copied = false;
  @state() private _menuOpen = false;
  private _copiedTimer: ReturnType<typeof setTimeout> | null = null;

  private _onLangChange = () => { this.requestUpdate(); };

  override connectedCallback() {
    super.connectedCallback();
    i18next.on("languageChanged", this._onLangChange);
  }

  override disconnectedCallback() {
    i18next.off("languageChanged", this._onLangChange);
    if (this._copiedTimer !== null) clearTimeout(this._copiedTimer);
    document.removeEventListener("pointerdown", this._onOutsidePointer, true);
    super.disconnectedCallback();
  }

  override willUpdate() {
    // Keep the bar visible while it shows something transient.
    this.active = this._copied || this._menuOpen;
  }

  // ── Overflow menu ───────────────────────────────────────────────────

  private _menuItems(): HTMLButtonElement[] {
    return [...(this.renderRoot.querySelectorAll<HTMLButtonElement>(".menu-item") ?? [])];
  }

  private _openMenu(focus: "first" | "last" = "first") {
    this._menuOpen = true;
    document.addEventListener("pointerdown", this._onOutsidePointer, true);
    this.updateComplete.then(() => {
      const items = this._menuItems();
      (focus === "first" ? items[0] : items[items.length - 1])?.focus();
    });
  }

  private _closeMenu(restoreFocus = false) {
    if (!this._menuOpen) return;
    this._menuOpen = false;
    document.removeEventListener("pointerdown", this._onOutsidePointer, true);
    if (restoreFocus) {
      this.updateComplete.then(() => this.renderRoot.querySelector<HTMLButtonElement>(".more-btn")?.focus());
    }
  }

  private _onOutsidePointer = (e: Event) => {
    if (!e.composedPath().includes(this)) this._closeMenu();
  };

  private _onTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      this._openMenu(e.key === "ArrowDown" ? "first" : "last");
    }
  }

  private _onMenuKeyDown(e: KeyboardEvent) {
    const items = this._menuItems();
    const index = items.indexOf(this.shadowRoot?.activeElement as HTMLButtonElement);
    const move = (next: number) => {
      e.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") move(index + 1);
    else if (e.key === "ArrowUp") move(index - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // don't let the widget's Escape handler close the chat
      this._closeMenu(true);
    } else if (e.key === "Tab") {
      this._closeMenu();
    }
  }

  private get _context(): MessageActionContext | null {
    if (!this.message) return null;
    return {
      message: this.message,
      sender: this.message.from === "user" ? "user" : "bot",
      isLatest: this.isLatest,
    };
  }

  /** Copy plain text; with Shift held, the raw Markdown source. */
  private async _copy(e: MouseEvent) {
    const msg = this.message;
    const raw = String(msg?.data?.text ?? "");
    if (!msg || !raw) return;
    const markdown = e.shiftKey;
    const ok = await copyText(markdown ? raw : markdownToPlainText(raw));
    if (!ok) return;
    EventBus.emit("message_copied", {
      messageId: msg.id,
      format: markdown ? "markdown" : "text",
    });
    this._copied = true;
    if (this._copiedTimer !== null) clearTimeout(this._copiedTimer);
    this._copiedTimer = setTimeout(() => {
      this._copiedTimer = null;
      this._copied = false;
    }, COPIED_MS);
  }

  private _dispatch(name: "chativa-regenerate" | "chativa-edit-start") {
    if (!this.message) return;
    this.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        composed: true,
        detail: { messageId: this.message.id },
      }),
    );
  }

  private async _runCustom(action: IMessageAction, ctx: MessageActionContext) {
    try {
      await action.execute(ctx);
    } catch (err) {
      console.error(`[message-actions] "${action.name}" failed:`, err);
    }
  }

  private _icon(content: unknown) {
    return html`<svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >${content}</svg>`;
  }

  /** SVG markup (starts with `<`) goes in the icon wrapper; anything else — an emoji — is shown as text. */
  private _renderCustomIcon(icon: string | undefined) {
    const value = icon?.trim();
    if (!value) return null;
    if (value.startsWith("<")) {
      return html`<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" aria-hidden="true">${unsafeSVG(value)}</svg>`;
    }
    return html`<span class="action-glyph" aria-hidden="true">${value}</span>`;
  }

  private _renderMenu(actions: IMessageAction[], ctx: MessageActionContext) {
    const label = t("message.moreActions");
    return html`
      <div class="more">
        <button
          type="button"
          class="action-btn more-btn"
          aria-label=${label}
          title=${label}
          aria-haspopup="menu"
          aria-expanded=${this._menuOpen ? "true" : "false"}
          @click=${() => (this._menuOpen ? this._closeMenu() : this._openMenu())}
          @keydown=${this._onTriggerKeyDown}
        >${this._icon(MORE_ICON)}</button>
        ${this._menuOpen ? html`
          <div class="menu" role="menu" aria-label=${label} @keydown=${this._onMenuKeyDown}>
            ${actions.map((action) => html`
              <button
                type="button"
                class="menu-item"
                role="menuitem"
                tabindex="-1"
                data-action=${action.name}
                @click=${() => {
                  this._closeMenu(true);
                  void this._runCustom(action, ctx);
                }}
              >
                <span class="menu-icon">${this._renderCustomIcon(action.icon)}</span>
                <span>${resolveMessageActionLabel(action, i18next.language)}</span>
              </button>
            `)}
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderCustom(action: IMessageAction, ctx: MessageActionContext) {
    const label = resolveMessageActionLabel(action, i18next.language);
    return html`
      <button
        type="button"
        class="action-btn custom"
        data-action=${action.name}
        aria-label=${label}
        title=${label}
        @click=${() => this._runCustom(action, ctx)}
      >${this._renderCustomIcon(action.icon) ?? label}</button>
    `;
  }

  override render() {
    const ctx = this._context;
    if (!ctx) return nothing;
    const { copy, regenerate, edit } = this.builtIns;
    const custom = MessageActionRegistry.forMessage(ctx);
    if (!copy && !regenerate && !edit && custom.length === 0) return nothing;
    const inline = custom.filter((a) => a.placement === "inline");
    const menu = custom.filter((a) => a.placement !== "inline");

    const copyLabel = this._copied ? t("message.copied") : t("message.copy");
    return html`
      <div class="actions" role="toolbar" aria-label=${t("message.actionsLabel")}>
        ${copy ? html`
          <button
            type="button"
            class="action-btn copy ${this._copied ? "copied" : ""}"
            aria-label=${copyLabel}
            title=${copyLabel}
            @click=${this._copy}
          >${this._icon(this._copied ? CHECK_ICON : COPY_ICON)}</button>
        ` : nothing}
        ${regenerate ? html`
          <button
            type="button"
            class="action-btn regenerate"
            aria-label=${t("message.regenerate")}
            title=${t("message.regenerate")}
            @click=${() => this._dispatch("chativa-regenerate")}
          >${this._icon(REGENERATE_ICON)}</button>
        ` : nothing}
        ${edit ? html`
          <button
            type="button"
            class="action-btn edit"
            aria-label=${t("message.edit")}
            title=${t("message.edit")}
            @click=${() => this._dispatch("chativa-edit-start")}
          >${this._icon(EDIT_ICON)}</button>
        ` : nothing}
        ${inline.map((action) => this._renderCustom(action, ctx))}
        ${menu.length > 0 ? this._renderMenu(menu, ctx) : nothing}
        <span class="sr-only" role="status">${this._copied ? t("message.copied") : ""}</span>
      </div>
    `;
  }
}

export default MessageActions;
