import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { conversationStore } from "@chativa/core";
import type { Conversation } from "@chativa/core";

/**
 * `<conversation-list>` — sidebar component for agent-panel mode.
 *
 * Reads from `conversationStore` and emits:
 *  - `conversation-select`  (detail: { id: string })
 *  - `new-conversation`     (no detail)
 *  - `conversation-close`   (detail: { id: string })
 */
@customElement("conversation-list")
export class ConversationList extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f8fafc;
      border-right: 1px solid #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      min-width: 0;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 14px 12px;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .header-title {
      font-size: 0.8125rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #94a3b8;
    }

    .new-btn {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: 1.5px solid #e2e8f0;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #64748b;
      font-size: 1.1rem;
      line-height: 1;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      padding: 0;
    }

    .new-btn:hover {
      background: #ede9fe;
      border-color: #4f46e5;
      color: #4f46e5;
    }

    /* ── List ── */
    .list {
      flex: 1;
      overflow-y: auto;
      padding: 6px 0;
    }

    /* ── Item ── */
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 14px;
      cursor: pointer;
      position: relative;
      transition: background 0.12s;
    }

    .item:hover {
      background: #f1f5f9;
    }

    .item.active {
      background: #ede9fe;
    }

    .item.closed {
      opacity: 0.5;
    }

    /* ── Avatar ── */
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--chativa-primary-color, #4f46e5);
      color: white;
      font-size: 0.8125rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }

    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* ── Text ── */
    .info {
      flex: 1;
      min-width: 0;
    }

    .name {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .last {
      font-size: 0.75rem;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 1px;
    }

    /* ── Right side: badge + close ── */
    .right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      flex-shrink: 0;
    }

    .badge {
      background: var(--chativa-primary-color, #4f46e5);
      color: white;
      border-radius: 10px;
      font-size: 0.6875rem;
      font-weight: 700;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .close-btn {
      width: 18px;
      height: 18px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      opacity: 0;
      transition: opacity 0.15s, color 0.15s;
      padding: 0;
    }

    .item:hover .close-btn {
      opacity: 1;
    }

    .close-btn:hover {
      color: #ef4444;
    }

    /* ── Status dot ── */
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-dot.open    { background: #22c55e; }
    .status-dot.pending { background: #f59e0b; }
    .status-dot.resolved,
    .status-dot.closed  { background: #94a3b8; }

    /* ── Empty state ── */
    .empty {
      padding: 32px 16px;
      text-align: center;
      color: #94a3b8;
      font-size: 0.8125rem;
    }
  `;

  @state() private _convs: Conversation[] = [];
  @state() private _activeId: string | null = null;
  private _unsub!: () => void;

  override connectedCallback() {
    super.connectedCallback();
    const s = conversationStore.getState();
    this._convs = s.conversations;
    this._activeId = s.activeConversationId;
    this._unsub = conversationStore.subscribe(() => {
      const next = conversationStore.getState();
      this._convs = next.conversations;
      this._activeId = next.activeConversationId;
    });
  }

  override disconnectedCallback() {
    this._unsub?.();
    super.disconnectedCallback();
  }

  private _initials(name: string): string {
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase();
  }

  private _onSelect(id: string) {
    this.dispatchEvent(
      new CustomEvent("conversation-select", {
        detail: { id },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onNew() {
    this.dispatchEvent(
      new CustomEvent("new-conversation", { bubbles: true, composed: true })
    );
  }

  private _onClose(e: Event, id: string) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("conversation-close", {
        detail: { id },
        bubbles: true,
        composed: true,
      })
    );
  }

  override render() {
    return html`
      <div class="header">
        <span class="header-title">Conversations</span>
        <button class="new-btn" @click=${this._onNew} title="New conversation" aria-label="New conversation">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <div class="list" role="listbox" aria-label="Conversations">
        ${this._convs.length === 0
          ? html`<div class="empty">No conversations yet</div>`
          : this._convs.map((c) => html`
            <div
              class="item ${c.id === this._activeId ? "active" : ""} ${c.status === "closed" ? "closed" : ""}"
              role="option"
              aria-selected=${c.id === this._activeId}
              @click=${() => this._onSelect(c.id)}
            >
              <div class="avatar">
                ${c.avatar
                  ? html`<img src=${c.avatar} alt=${c.contact ?? c.title} />`
                  : this._initials(c.contact ?? c.title)}
              </div>

              <div class="info">
                <div class="name">${c.contact ?? c.title}</div>
                ${c.lastMessage
                  ? html`<div class="last">${c.lastMessage}</div>`
                  : nothing}
              </div>

              <div class="right">
                ${c.unreadCount
                  ? html`<div class="badge">${c.unreadCount}</div>`
                  : nothing}
                <button
                  class="close-btn"
                  @click=${(e: Event) => this._onClose(e, c.id)}
                  title="Close conversation"
                  aria-label="Close conversation"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div class="status-dot ${c.status}" title=${c.status}></div>
            </div>
          `)
        }
      </div>
    `;
  }
}
