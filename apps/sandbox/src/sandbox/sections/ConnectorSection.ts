import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  chatStore,
  ConnectorRegistry,
  type ConnectorStatus,
  type IConnector,
} from "@chativa/core";
import { DirectLineConnector } from "@chativa/connector-directline";
import { MekikConnector } from "@chativa/connector-mekik";
import { ConvergerConnector } from "@chativa/connector-converger";
import { sectionStyles } from "../sandboxShared";
import {
  convergerPublishableAuth,
  convergerSocketUrl,
  convergerStaticAuth,
  convergerTokenAuth,
  type ConvergerCredentialMode,
} from "../convergerToken";
import {
  buildDummyConnector,
  getDummyOptions,
  setDummyOptions,
  subscribeDummyOptions,
  swapConnector,
} from "../connectorSwap";

type ConnectorKind = "dummy" | "directline" | "mekik" | "mekik-converger" | "converger";

interface DummyForm {
  replyDelay: number;
  connectDelay: number;
}

interface MekikForm {
  url: string;
  reconnect: boolean;
}

/** Shared by both Converger presets (connector-mekik and connector-converger). */
interface ConvergerForm {
  /** Converger base URL; the socket is `<base>/socket/converger/v1`. */
  base: string;
  /** Where the token comes from. */
  credential: ConvergerCredentialMode;
  /** "Dev server" only: the user the dev server mints the token for. */
  userId: string;
  /** Empty: the server starts a conversation and `welcome` names it. Not for a publishable key. */
  conversationId: string;
  /** "Token": pasted by hand. */
  token: string;
  /** "Publishable key": `cvg_pk_...`. */
  publishableKey: string;
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

  @state() private _dummy: DummyForm = {
    replyDelay: getDummyOptions().replyDelay,
    connectDelay: getDummyOptions().connectDelay,
  };
  @state() private _directline: DirectLineForm = {
    token: "",
    userId: "",
    locale: "",
    resumeConversation: false,
  };
  @state() private _mekik: MekikForm = {
    url: "ws://localhost:8790/chat",
    reconnect: true,
  };
  @state() private _converger: ConvergerForm = {
    base: "http://localhost:4000",
    credential: "dev-server",
    userId: "sandbox-user",
    conversationId: "",
    token: "",
    publishableKey: "",
  };

  private _unsub!: () => void;
  private _unsubDummy!: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsubDummy = subscribeDummyOptions((o) => {
      this._dummy = { replyDelay: o.replyDelay, connectDelay: o.connectDelay };
    });
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
    this._unsubDummy?.();
    super.disconnectedCallback();
  }

  /** Build a connector from the current form state and apply it. */
  private _connect() {
    this._feedback = null;
    try {
      const instance = this._buildConnector();
      swapConnector(instance);

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
      // Delays come from this form; rules come from the Rules tab.
      setDummyOptions({
        replyDelay: Number(this._dummy.replyDelay) || 0,
        connectDelay: Number(this._dummy.connectDelay) || 0,
      });
      return buildDummyConnector();
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
    if (this._kind === "mekik") {
      const f = this._mekik;
      if (!f.url.trim()) {
        throw new Error("mekik: WebSocket URL is required.");
      }
      return new MekikConnector({
        url: f.url.trim(),
        reconnect: f.reconnect,
      });
    }
    if (this._kind === "mekik-converger" || this._kind === "converger") {
      const f = this._converger;
      if (!f.base.trim()) {
        throw new Error("Converger: base URL is required.");
      }
      const options = {
        url: convergerSocketUrl(f.base),
        auth: this._convergerAuth(),
        // A publishable key's token is bound to the key's own conversation.
        conversationId:
          f.credential === "publishable-key" ? undefined : f.conversationId.trim() || undefined,
        // conversationId in the query string: an L7 balancer can route by it.
        routeInUrl: true,
        // Only the dev server's user is stable across reloads; a pasted token
        // carries its own, and a publishable key keeps its conversation itself.
        resumeConversation: f.credential === "dev-server",
      };
      // connector-mekik, unchanged: Converger serves it the mekik/1 profile.
      // connector-converger: the full protocol plus receipts, upload, history.
      return this._kind === "converger" ? new ConvergerConnector(options) : new MekikConnector(options);
    }
    throw new Error(`Unknown connector kind: ${this._kind}`);
  }

  /** The auth provider for the Converger presets' credential mode. */
  private _convergerAuth() {
    const f = this._converger;
    if (f.credential === "token") {
      if (!f.token.trim()) throw new Error("Converger: paste a token.");
      return convergerStaticAuth(f.token);
    }
    if (f.credential === "publishable-key") {
      if (!f.publishableKey.trim()) throw new Error("Converger: paste a publishable key (cvg_pk_...).");
      return convergerPublishableAuth(f.base, f.publishableKey);
    }
    // The dev server's /api/converger-token mints it (vite.config.ts).
    return convergerTokenAuth({ userId: f.userId.trim() || undefined });
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

  private _renderMekikOptions() {
    return html`
      <div class="field-grid">
        <label for="mekik-url">WS URL</label>
        <input id="mekik-url" type="text" placeholder="ws://localhost:8790/chat"
          .value=${this._mekik.url}
          @input=${(e: Event) => {
            this._mekik = { ...this._mekik, url: (e.target as HTMLInputElement).value };
          }} />
      </div>
      <div class="checkbox-row">
        <input id="mekik-reconnect" type="checkbox" .checked=${this._mekik.reconnect}
          @change=${(e: Event) => {
            this._mekik = { ...this._mekik, reconnect: (e.target as HTMLInputElement).checked };
          }} />
        <label for="mekik-reconnect">Auto-reconnect (queues messages while down)</label>
      </div>
    `;
  }

  private _renderConvergerOptions() {
    const f = this._converger;
    const set = (patch: Partial<ConvergerForm>) => {
      this._converger = { ...this._converger, ...patch };
    };
    const value = (e: Event) => (e.target as HTMLInputElement).value;
    return html`
      <div class="field-grid">
        <label for="cv-base">Converger</label>
        <input id="cv-base" type="text" placeholder="http://localhost:4000"
          .value=${f.base}
          @input=${(e: Event) => set({ base: value(e) })} />
        <label for="cv-credential">Credential</label>
        <select id="cv-credential" class="kind" .value=${f.credential}
          @change=${(e: Event) => set({ credential: value(e) as ConvergerCredentialMode })}>
          <option value="dev-server">Dev server</option>
          <option value="token">Token</option>
          <option value="publishable-key">Publishable key</option>
        </select>
        ${f.credential === "dev-server"
          ? html`
              <label for="cv-user">User ID</label>
              <input id="cv-user" type="text" placeholder="(optional)"
                .value=${f.userId}
                @input=${(e: Event) => set({ userId: value(e) })} />`
          : nothing}
        ${f.credential === "token"
          ? html`
              <label for="cv-token">Token</label>
              <input id="cv-token" type="password" placeholder="Converger token (required)"
                .value=${f.token}
                @input=${(e: Event) => set({ token: value(e) })} />`
          : nothing}
        ${f.credential === "publishable-key"
          ? html`
              <label for="cv-pk">Key</label>
              <input id="cv-pk" type="text" placeholder="cvg_pk_... (required)"
                .value=${f.publishableKey}
                @input=${(e: Event) => set({ publishableKey: value(e) })} />`
          : html`
              <label for="cv-conv">Conversation</label>
              <input id="cv-conv" type="text" placeholder="(new)"
                .value=${f.conversationId}
                @input=${(e: Event) => set({ conversationId: value(e) })} />`}
      </div>
      <div class="feedback ok">${this._renderConvergerHint()}</div>
    `;
  }

  /** What the selected credential mode needs, from this dev server and from Converger. */
  private _renderConvergerHint() {
    const cors = html`Start Converger with <code>CORS_ORIGINS=${location.origin}</code>.`;
    switch (this._converger.credential) {
      case "token":
        return html`
          Paste a Converger token, e.g. from the channel page's <b>Test token</b>
          action. It is used as is: once it expires, paste a new one and connect
          again. ${cors}
        `;
      case "publishable-key":
        return html`
          Paste the channel's publishable key (<code>cvg_pk_...</code>). The browser
          exchanges it at <code>/api/v1/converger/tokens/publishable</code> and keeps
          the conversation in localStorage per key, so a reload continues it. Add
          <code>${location.origin}</code> to the channel's allowed origins; needs a
          Converger with publishable keys (AimTune/converger#195). ${cors}
        `;
      default:
        return html`
          Tokens come from this dev server's <code>/api/converger-token</code>: start
          <code>pnpm dev</code> with <code>CONVERGER_CHANNEL_SECRET</code> (and
          <code>CONVERGER_URL</code>). ${cors}
        `;
    }
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
                  <option value="mekik">mekik (agent bridge)</option>
                  <option value="mekik-converger">mekik behind Converger (connector-mekik)</option>
                  <option value="converger">Converger hub (connector-converger)</option>
                </select>
              </div>

              ${this._kind === "dummy"      ? this._renderDummyOptions()      : nothing}
              ${this._kind === "directline" ? this._renderDirectLineOptions() : nothing}
              ${this._kind === "mekik"     ? this._renderMekikOptions()     : nothing}
              ${this._kind === "mekik-converger" || this._kind === "converger"
                ? this._renderConvergerOptions()
                : nothing}

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
