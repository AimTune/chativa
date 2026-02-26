import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  ConnectorRegistry,
  MultiConversationEngine,
  messageStore,
  conversationStore,
  createOutgoingMessage,
} from "@chativa/core";
import { registerCommand } from "../commands/index";
import "./ConversationList";
import "./ChatHeader";
import "./ChatMessageList";
import "./ChatInput";

/**
 * `<agent-panel>` — embedded multi-conversation panel for agent / support desk use.
 *
 * Shows a sidebar with the conversation list on the left and the active chat on the right.
 * Does NOT show a floating button — it's meant to be embedded directly in an application.
 *
 * Attributes:
 *   connector  — name of the registered connector (default: "dummy")
 *   sidebar-width — CSS width of the conversation sidebar (default: "260px")
 *
 * Example:
 *   <agent-panel connector="dummy"></agent-panel>
 */
@customElement("agent-panel")
export class AgentPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 32px rgba(0, 0, 0, 0.1);
    }

    .panel {
      display: flex;
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    /* ── Sidebar ── */
    .sidebar {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Chat area ── */
    .chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 0;
      background: white;
    }

    /* ── Empty state (no active conversation) ── */
    .no-conv {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #94a3b8;
    }

    .no-conv-icon {
      opacity: 0.35;
    }

    .no-conv-text {
      font-size: 0.875rem;
      font-weight: 500;
    }
  `;

  @property({ type: String }) connector = "dummy";
  @property({ type: String, attribute: "sidebar-width" }) sidebarWidth = "260px";

  @state() private _activeId: string | null = null;
  @state() private _msgVersion = 0;

  private _engine!: MultiConversationEngine;
  private _unsubConv!: () => void;
  private _unsubMsg!: () => void;

  override connectedCallback() {
    super.connectedCallback();

    // Register built-in /clear command
    registerCommand({
      name: "clear",
      translations: {
        en: { description: "Clear messages" },
        tr: { description: "Mesajları temizle" },
      },
      execute() {
        messageStore.getState().clear();
      },
    });

    const adapter = ConnectorRegistry.get(this.connector);
    this._engine = new MultiConversationEngine(adapter);
    this._engine.init().catch((err: unknown) => {
      console.error("[AgentPanel] Engine init failed:", err);
    });

    this._unsubConv = conversationStore.subscribe(() => {
      this._activeId = conversationStore.getState().activeConversationId;
    });
    this._unsubMsg = messageStore.subscribe(() => {
      this._msgVersion = messageStore.getState().version;
    });
    this._activeId = conversationStore.getState().activeConversationId;

    // Note: send-message is bound via template (@send-message on <chat-input>)
    // All other events bubble up composedly from inner shadow components
    this.addEventListener("conversation-select", this._onConvSelect as EventListener);
    this.addEventListener("new-conversation", this._onNewConv as EventListener);
    this.addEventListener("conversation-close", this._onConvClose as EventListener);
    this.addEventListener("chat-action", this._onChatAction as EventListener);
    this.addEventListener("chativa-feedback", this._onFeedback as EventListener);
    this.addEventListener("chat-retry", this._onRetry as EventListener);
    this.addEventListener("send-file", this._onSendFile as EventListener);
    this.addEventListener("chat-load-history", this._onLoadHistory as EventListener);
    this.addEventListener("genui-send-event", this._onGenUISendEvent as EventListener);
  }

  override disconnectedCallback() {
    this._unsubConv?.();
    this._unsubMsg?.();
    this._engine?.destroy().catch(() => {});
    this.removeEventListener("conversation-select", this._onConvSelect as EventListener);
    this.removeEventListener("new-conversation", this._onNewConv as EventListener);
    this.removeEventListener("conversation-close", this._onConvClose as EventListener);
    this.removeEventListener("chat-action", this._onChatAction as EventListener);
    this.removeEventListener("chativa-feedback", this._onFeedback as EventListener);
    this.removeEventListener("chat-retry", this._onRetry as EventListener);
    this.removeEventListener("send-file", this._onSendFile as EventListener);
    this.removeEventListener("chat-load-history", this._onLoadHistory as EventListener);
    this.removeEventListener("genui-send-event", this._onGenUISendEvent as EventListener);
    super.disconnectedCallback();
  }

  // ── Event handlers ────────────────────────────────────────────────────

  private _onConvSelect = (e: CustomEvent<{ id: string }>) => {
    this._engine.switchTo(e.detail.id).catch((err: unknown) =>
      console.error("[AgentPanel] switchTo failed:", err)
    );
  };

  private _onNewConv = () => {
    this._engine.createNew().catch((err: unknown) =>
      console.error("[AgentPanel] createNew failed:", err)
    );
  };

  private _onConvClose = (e: CustomEvent<{ id: string }>) => {
    this._engine.close(e.detail.id).catch((err: unknown) =>
      console.error("[AgentPanel] close failed:", err)
    );
  };

  private _onSendMessage = (e: CustomEvent<string>) => {
    const text = e.detail?.trim();
    if (!text) return;
    this._engine.chatEngine
      .send(createOutgoingMessage(text))
      .catch((err: unknown) => console.error("[AgentPanel] Send failed:", err));
  };

  private _onChatAction = (e: Event) => {
    const text = (e as CustomEvent<string>).detail?.trim();
    if (!text) return;
    this._engine.chatEngine
      .send(createOutgoingMessage(text))
      .catch((err: unknown) => console.error("[AgentPanel] Action send failed:", err));
  };

  private _onFeedback = (e: CustomEvent<{ messageId: string; feedback: "like" | "dislike" }>) => {
    this._engine.chatEngine
      .sendFeedback(e.detail.messageId, e.detail.feedback)
      .catch((err: unknown) => console.error("[AgentPanel] Feedback failed:", err));
  };

  private _onRetry = () => {
    this._engine.chatEngine
      .init()
      .catch((err: unknown) => console.error("[AgentPanel] Reconnect failed:", err));
  };

  private _onSendFile = (e: CustomEvent<{ files: File[]; text: string }>) => {
    const { files, text } = e.detail;
    for (const file of files) {
      this._engine.chatEngine
        .sendFile(file, text ? { caption: text } : undefined)
        .catch((err: unknown) => console.error("[AgentPanel] sendFile failed:", err));
    }
  };

  private _onLoadHistory = () => {
    this._engine.chatEngine
      .loadHistory()
      .catch((err: unknown) => console.error("[AgentPanel] loadHistory failed:", err));
  };

  private _onGenUISendEvent = (
    e: CustomEvent<{ msgId: string; eventType: string; payload: unknown }>
  ) => {
    this._engine.chatEngine.receiveComponentEvent(
      e.detail.msgId,
      e.detail.eventType,
      e.detail.payload
    );
  };

  // ── Render ────────────────────────────────────────────────────────────

  override render() {
    // Subscribe to msgVersion to force re-render on message changes
    void this._msgVersion;

    return html`
      <div class="panel">
        <!-- Sidebar -->
        <div class="sidebar" style="width: ${this.sidebarWidth}">
          <conversation-list></conversation-list>
        </div>

        <!-- Chat area -->
        <div class="chat-area">
          ${this._activeId === null
            ? html`
                <div class="no-conv">
                  <svg class="no-conv-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span class="no-conv-text">Select a conversation</span>
                </div>
              `
            : html`
                <chat-header></chat-header>
                <chat-message-list></chat-message-list>
                <chat-input @send-message=${this._onSendMessage}></chat-input>
              `}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "agent-panel": AgentPanel;
  }
}
