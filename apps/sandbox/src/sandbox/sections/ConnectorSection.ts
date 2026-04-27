import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  chatStore,
  messageStore,
  ConnectorRegistry,
  type ConnectorStatus,
  type IConnector,
} from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";
import { DirectLineConnector } from "@chativa/connector-directline";
import { sectionStyles } from "../sandboxShared";

type ConnectorKind = "dummy" | "directline";

interface DummyForm {
  replyDelay: number;
  connectDelay: number;
}

interface DirectLineForm {
  token: string;
  userId: string;
  locale: string;
  resumeConversation: boolean;
}

const CAPABILITIES: { method: keyof IConnector; label: string; doc: string }[] = [
  { method: "onTyping",            label: "Typing indicator",         doc: "Shows the typing dots when the bot is composing." },
  { method: "sendFile",            label: "File upload",              doc: "Enables the attach button in the chat input." },
  { method: "loadHistory",         label: "History pagination",       doc: "Scroll-to-top loads older messages." },
  { method: "onMessageStatus",     label: "Delivery / read ticks",    doc: "Sending → Sent → Read indicators on user messages." },
  { method: "sendFeedback",        label: "Like / dislike",           doc: "Thumbs up / down on bot messages." },
  { method: "sendSurvey",          label: "End-of-conversation survey", doc: "Star rating + comment on close." },
  { method: "onGenUIChunk",        label: "GenUI streaming",          doc: "Stream LitElement components inline in messages." },
  { method: "listConversations",   label: "Multi-conversation",       doc: "Conversation list view inside the popup." },
];

/** Snapshot of which capabilities the currently active connector implements. */
function detectCapabilities(): Record<string, boolean> {
  const name = chatStore.getState().activeConnector;
  const c = name ? ConnectorRegistry.get(name) : undefined;
  const result: Record<string, boolean> = {};
  for (const { method } of CAPABILITIES) {
    result[method as string] =
      typeof (c as unknown as Record<string, unknown> | undefined)?.[method as string] ===
      "function";
  }
  return result;
}

@customElement("sandbox-connector-section")
export class ConnectorSection extends LitElement {
  static override styles = [
    sectionStyles,
    css`
      .stack { display: flex; flex-direction: column; gap: 12px; }

      .active-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        background: #f8fafc;
        border: 1.5px solid #e2e8f0;
      }
      .active-name {
        font-size: 0.8125rem;
        font-weight: 600;
        color: #0f172a;
        flex: 1;
        font-family: "SF Mono", "Fira Mono", Menlo, monospace;
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.6875rem;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 999px;
      }
      .status .dot { width: 6px; height: 6px; border-radius: 50%; }
      .status.idle         { background: #f1f5f9; color: #64748b; }
      .status.idle .dot         { background: #94a3b8; }
      .status.connecting   { background: #fef9c3; color: #854d0e; }
      .status.connecting .dot   { background: #facc15; }
      .status.connected    { background: #dcfce7; color: #166534; }
      .status.connected .dot    { background: #4ade80; }
      .status.error        { background: #fee2e2; color: #991b1b; }
      .status.error .dot        { background: #f87171; }
      .status.disconnected { background: #f1f5f9; color: #64748b; }
      .status.disconnected .dot { background: #94a3b8; }

      select.kind {
        width: 100%;
        height: 32px;
        border: 1.5px solid #e2e8f0;
        border-radius: 8px;
        background: white;
        font-family: inherit;
        font-size: 0.8125rem;
        color: #0f172a;
        padding: 0 8px;
        cursor: pointer;
        outline: none;
      }
      select.kind:focus { border-color: #4f46e5; }

      .field-grid {
        display: grid;
        grid-template-columns: 96px 1fr;
        gap: 6px 8px;
        align-items: center;
      }
      .field-grid label {
        font-size: 0.6875rem;
        font-weight: 600;
        color: #64748b;
      }
      .field-grid input[type="text"],
      .field-grid input[type="number"],
      .field-grid input[type="password"] {
        width: 100%;
        height: 28px;
        border: 1.5px solid #e2e8f0;
        border-radius: 6px;
        background: #f8fafc;
        font-family: "SF Mono", "Fira Mono", Menlo, monospace;
        font-size: 0.75rem;
        color: #0f172a;
        padding: 0 8px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.12s, background 0.12s;
      }
      .field-grid input:focus { border-color: #4f46e5; background: white; }

      .checkbox-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
      }
      .checkbox-row label {
        font-size: 0.75rem;
        font-weight: 500;
        color: #475569;
      }

      .connect-btn {
        width: 100%;
        padding: 9px 12px;
        border: none;
        border-radius: 9px;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: white;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: opacity 0.15s, transform 0.15s;
      }
      .connect-btn:hover { opacity: 0.92; }
      .connect-btn:active { transform: scale(0.98); }

      .feedback {
        font-size: 0.6875rem;
        font-weight: 500;
        padding: 6px 9px;
        border-radius: 7px;
        line-height: 1.4;
      }
      .feedback.ok  { background: #dcfce7; color: #166534; }
      .feedback.err { background: #fee2e2; color: #991b1b; }

      .cap-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 8px;
      }
      .cap {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 6px;
        border-radius: 6px;
        font-size: 0.6875rem;
        cursor: help;
      }
      .cap.on  { color: #166534; background: #f0fdf4; }
      .cap.off { color: #94a3b8; background: #f8fafc; opacity: 0.65; }
      .cap-icon {
        width: 12px; height: 12px;
        flex-shrink: 0;
      }
    `,
  ];

  @state() private _open = true;
  @state() private _kind: ConnectorKind =
    (chatStore.getState().activeConnector as ConnectorKind) ?? "dummy";
  @state() private _status: ConnectorStatus = chatStore.getState().connectorStatus;
  @state() private _activeName: string = chatStore.getState().activeConnector;
  @state() private _capabilities: Record<string, boolean> = detectCapabilities();
  @state() private _feedback: { msg: string; ok: boolean } | null = null;

  @state() private _dummy: DummyForm = { replyDelay: 500, connectDelay: 2000 };
  @state() private _directline: DirectLineForm = {
    token: "",
    userId: "",
    locale: "",
    resumeConversation: false,
  };

  private _unsub!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = chatStore.subscribe(() => {
      const s = chatStore.getState();
      this._status = s.connectorStatus;
      if (s.activeConnector !== this._activeName) {
        this._activeName = s.activeConnector;
        this._capabilities = detectCapabilities();
      } else if (this._status === "connected") {
        // Re-detect on connect — lets late capability registration show up.
        this._capabilities = detectCapabilities();
      }
    });
  }

  disconnectedCallback() {
    this._unsub?.();
    super.disconnectedCallback();
  }

  /** Build a connector from the current form state and apply it. */
  private _connect() {
    this._feedback = null;
    try {
      const instance = this._buildConnector();
      // Replace any same-named instance in the registry with the new one.
      ConnectorRegistry.register(instance);
      chatStore.getState().setConnector(instance.name);

      // Wipe runtime state from the previous session so the new connector
      // starts clean (mirrors what ChatWidget._resetConversation does after
      // a survey submit).
      messageStore.getState().clear();
      chatStore.setState({
        connectorStatus: "idle",
        isTyping: false,
        unreadCount: 0,
        reconnectAttempt: 0,
        hasMoreHistory: false,
        isLoadingHistory: false,
        historyCursor: undefined,
        searchQuery: "",
        isRendered: false,
      });

      // Replace the <chat-iva> element so its connectedCallback re-binds
      // the engine to the newly registered adapter. ChatWidget.disconnectedCallback
      // calls _multiEngine.destroy(), which disconnects the old connector.
      const old = document.querySelector("chat-iva");
      if (old?.parentNode) {
        const fresh = document.createElement(old.tagName.toLowerCase());
        for (const attr of Array.from(old.attributes)) {
          fresh.setAttribute(attr.name, attr.value);
        }
        old.parentNode.replaceChild(fresh, old);
      }

      this._feedback = {
        msg: `Connected ${instance.name}. Open the widget to talk to it.`,
        ok: true,
      };
      this._capabilities = detectCapabilities();
    } catch (err) {
      this._feedback = { msg: (err as Error).message, ok: false };
    }
  }

  private _buildConnector(): IConnector {
    if (this._kind === "dummy") {
      return new DummyConnector({
        replyDelay: Number(this._dummy.replyDelay) || 0,
        connectDelay: Number(this._dummy.connectDelay) || 0,
      });
    }
    if (this._kind === "directline") {
      const f = this._directline;
      if (!f.token.trim()) {
        throw new Error("DirectLine: token is required.");
      }
      return new DirectLineConnector({
        token: f.token.trim(),
        userId: f.userId.trim() || undefined,
        locale: f.locale.trim() || undefined,
        resumeConversation: f.resumeConversation,
      });
    }
    throw new Error(`Unknown connector kind: ${this._kind}`);
  }

  private _renderDummyOptions() {
    return html`
      <div class="field-grid">
        <label for="dum-reply">Reply delay</label>
        <input id="dum-reply" type="number" min="0" .value=${String(this._dummy.replyDelay)}
          @input=${(e: Event) => {
            this._dummy = { ...this._dummy, replyDelay: Number((e.target as HTMLInputElement).value) };
          }} />
        <label for="dum-conn">Connect delay</label>
        <input id="dum-conn" type="number" min="0" .value=${String(this._dummy.connectDelay)}
          @input=${(e: Event) => {
            this._dummy = { ...this._dummy, connectDelay: Number((e.target as HTMLInputElement).value) };
          }} />
      </div>
    `;
  }

  private _renderDirectLineOptions() {
    return html`
      <div class="field-grid">
        <label for="dl-token">Token</label>
        <input id="dl-token" type="password" placeholder="DirectLine token (required)"
          .value=${this._directline.token}
          @input=${(e: Event) => {
            this._directline = { ...this._directline, token: (e.target as HTMLInputElement).value };
          }} />
        <label for="dl-user">User ID</label>
        <input id="dl-user" type="text" placeholder="(optional)"
          .value=${this._directline.userId}
          @input=${(e: Event) => {
            this._directline = { ...this._directline, userId: (e.target as HTMLInputElement).value };
          }} />
        <label for="dl-locale">Locale</label>
        <input id="dl-locale" type="text" placeholder="e.g. tr-TR"
          .value=${this._directline.locale}
          @input=${(e: Event) => {
            this._directline = { ...this._directline, locale: (e.target as HTMLInputElement).value };
          }} />
      </div>
      <div class="checkbox-row">
        <input id="dl-resume" type="checkbox" .checked=${this._directline.resumeConversation}
          @change=${(e: Event) => {
            this._directline = {
              ...this._directline,
              resumeConversation: (e.target as HTMLInputElement).checked,
            };
          }} />
        <label for="dl-resume">Resume across reloads (localStorage)</label>
      </div>
    `;
  }

  private _renderCapabilities() {
    return html`
      <div class="cap-grid">
        ${CAPABILITIES.map(({ method, label, doc }) => {
          const on = this._capabilities[method as string];
          const icon = on
            ? html`<svg class="cap-icon" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
            : html`<svg class="cap-icon" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`;
          return html`<div class="cap ${on ? "on" : "off"}" title=${doc}>${icon}<span>${label}</span></div>`;
        })}
      </div>
    `;
  }

  render() {
    return html`
      <div class="section-header" @click=${() => (this._open = !this._open)}>
        <span class="section-label">Connector</span>
        <svg class="chevron ${this._open ? "open" : ""}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      ${this._open
        ? html`
            <div class="section-body stack">

              <div class="active-row">
                <span class="active-name">${this._activeName || "(none)"}</span>
                <span class="status ${this._status}">
                  <span class="dot"></span>${this._status}
                </span>
              </div>

              <div>
                <div class="sub-label">Switch / configure</div>
                <select class="kind" .value=${this._kind}
                  @change=${(e: Event) => {
                    this._kind = (e.target as HTMLSelectElement).value as ConnectorKind;
                    this._feedback = null;
                  }}>
                  <option value="dummy">Dummy (local mock)</option>
                  <option value="directline">DirectLine (Azure Bot Framework)</option>
                </select>
              </div>

              ${this._kind === "dummy"      ? this._renderDummyOptions()      : nothing}
              ${this._kind === "directline" ? this._renderDirectLineOptions() : nothing}

              <button class="connect-btn" @click=${() => this._connect()}>
                Connect
              </button>

              ${this._feedback
                ? html`<div class="feedback ${this._feedback.ok ? "ok" : "err"}">${this._feedback.msg}</div>`
                : nothing}

              <div>
                <div class="sub-label">Capabilities (active connector)</div>
                ${this._renderCapabilities()}
              </div>

            </div>
          `
        : nothing}
    `;
  }
}
