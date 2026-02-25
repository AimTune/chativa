import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  chatStore,
  DEFAULT_THEME,
  type ThemeConfig,
  type ButtonPosition,
  type ButtonSize,
  type SpaceLevel,
  type DeepPartial,
} from "@chativa/core";
import { i18n } from "@chativa/ui";

const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "Indigo", value: "#4f46e5" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Pink", value: "#db2777" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Green", value: "#16a34a" },
  { label: "Sky", value: "#0284c7" },
  { label: "Slate", value: "#475569" },
];

@customElement("sandbox-controls")
export class SandboxControls extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
    }

    /* ── Collapsed toggle button ── */
    .toggle {
      position: fixed;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(79, 70, 229, 0.4);
      z-index: 9998;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .toggle:hover {
      transform: translateY(-50%) scale(1.1);
    }

    /* ── Panel ── */
    .panel {
      position: fixed;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 272px;
      background: white;
      border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.13),
        0 2px 10px rgba(0, 0, 0, 0.06);
      z-index: 9998;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 13px 16px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white;
      flex-shrink: 0;
    }

    .panel-title {
      font-size: 0.875rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .panel-close {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(255, 255, 255, 0.15);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      padding: 0;
    }
    .panel-close:hover {
      background: rgba(255, 255, 255, 0.28);
    }
    .panel-close svg {
      width: 13px;
      height: 13px;
    }

    .panel-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
    }
    .panel-body::-webkit-scrollbar {
      width: 3px;
    }
    .panel-body::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 3px;
    }

    /* ── Section ── */
    .section-label {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 8px;
    }

    .divider {
      height: 1px;
      background: #f1f5f9;
      margin: 0;
    }

    /* ── Position selector (mini screen) ── */
    .pos-screen {
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      background: #f8fafc;
      display: grid;
      grid-template-columns: auto 1fr auto;
      grid-template-rows: auto 1fr auto;
      padding: 7px;
      gap: 3px;
      height: 80px;
    }

    .pos-corner {
      width: 46px;
      height: 28px;
      border: 1.5px solid #e2e8f0;
      border-radius: 7px;
      background: white;
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
      transition: all 0.15s;
      padding: 0;
    }
    .pos-corner:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }
    .pos-corner.active {
      background: #4f46e5;
      border-color: #4f46e5;
      color: white;
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
    }

    /* ── Color swatches ── */
    .colors {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }

    .color-swatch {
      width: 100%;
      aspect-ratio: 1;
      border-radius: 50%;
      border: 2.5px solid transparent;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      padding: 0;
    }
    .color-swatch:hover {
      transform: scale(1.15);
    }
    .color-swatch.active {
      border-color: #0f172a;
      transform: scale(1.15);
      box-shadow: 0 0 0 2px white, 0 0 0 4px currentColor;
    }

    .color-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    input[type="color"].color-native {
      -webkit-appearance: none;
      appearance: none;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1.5px solid #e2e8f0;
      cursor: pointer;
      padding: 3px;
      background: transparent;
      flex-shrink: 0;
    }
    input[type="color"].color-native::-webkit-color-swatch-wrapper {
      padding: 0;
      border-radius: 4px;
    }
    input[type="color"].color-native::-webkit-color-swatch {
      border: none;
      border-radius: 4px;
    }

    .color-text {
      flex: 1;
      height: 34px;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      padding: 0 10px;
      font-size: 0.8125rem;
      font-family: "SF Mono", "Fira Code", "Fira Mono", monospace;
      color: #0f172a;
      background: #f8fafc;
      outline: none;
      transition: border-color 0.15s, background 0.15s;
    }
    .color-text:focus {
      border-color: #4f46e5;
      background: white;
    }

    /* ── Toggle group ── */
    .toggle-group {
      display: flex;
      gap: 3px;
      background: #f1f5f9;
      border-radius: 9px;
      padding: 3px;
    }

    .tg-btn {
      flex: 1;
      padding: 6px 4px;
      border: none;
      border-radius: 7px;
      background: transparent;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tg-btn:hover {
      color: #0f172a;
    }
    .tg-btn.active {
      background: white;
      color: #4f46e5;
      font-weight: 600;
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.09);
    }

    /* ── Message type demo buttons ── */
    .msg-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .msg-btn {
      padding: 7px 6px;
      border-radius: 8px;
      border: 1.5px solid #e2e8f0;
      background: #f8fafc;
      font-size: 0.75rem;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      text-align: center;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .msg-btn:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
      color: #0f172a;
    }

    /* ── Actions ── */
    .actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      flex: 1;
      padding: 8px 12px;
      border-radius: 9px;
      border: none;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.15s;
    }
    .btn:hover {
      opacity: 0.88;
    }
    .btn:active {
      transform: scale(0.96);
    }

    .btn-primary {
      background: #4f46e5;
      color: white;
    }
    .btn-ghost {
      background: #f1f5f9;
      color: #475569;
    }

    /* ── Chat status badge ── */
    .chat-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #64748b;
      padding-bottom: 2px;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }
    .status-dot.open { background: #4ade80; }
    .status-dot.closed { background: #94a3b8; }
  `;

  @state() private _isOpen = true;
  @state() private _theme: ThemeConfig = chatStore.getState().theme;
  @state() private _chatOpen = chatStore.getState().isOpened;
  @state() private _isFullscreen = chatStore.getState().isFullscreen;
  @state() private _colorHex = chatStore.getState().theme.colors.primary;
  @state() private _lang = i18n.language;

  private _unsub!: () => void;
  private _onLangChange = (lng: string) => { this._lang = lng; };

  connectedCallback() {
    super.connectedCallback();
    this._unsub = chatStore.subscribe(() => {
      const s = chatStore.getState();
      this._theme = s.theme;
      this._chatOpen = s.isOpened;
      this._isFullscreen = s.isFullscreen;
      this._colorHex = s.theme.colors.primary;
    });
    i18n.on("languageChanged", this._onLangChange);
  }

  disconnectedCallback() {
    this._unsub?.();
    i18n.off("languageChanged", this._onLangChange);
    super.disconnectedCallback();
  }

  private _set(overrides: DeepPartial<ThemeConfig>) {
    chatStore.getState().setTheme(overrides);
  }

  private _inject(msg: Record<string, unknown>) {
    const inject = (window as unknown as Record<string, unknown>).chativaInject as
      | ((msg: Record<string, unknown>) => void)
      | undefined;
    if (!inject) return;
    // Open chat if closed so the message is visible
    if (!chatStore.getState().isOpened) chatStore.getState().toggle();
    inject(msg);
  }

  private _triggerGenUI(command: string) {
    const trigger = (window as unknown as Record<string, unknown>).chativaGenUI as
      | ((command: string) => void)
      | undefined;
    if (!trigger) return;
    if (!chatStore.getState().isOpened) chatStore.getState().toggle();
    trigger(command);
  }

  private _demoMessages: Array<{ label: string; msg: Record<string, unknown> }> = [
    {
      label: "💬 Text",
      msg: { type: "text", data: { text: "Hello! This is a **text** message with _markdown_ support." } },
    },
    {
      label: "⚡ Quick Reply",
      msg: {
        type: "quick-reply",
        data: {
          text: "Which option do you prefer?",
          actions: [{ label: "Option A" }, { label: "Option B" }, { label: "Option C" }],
        },
      },
    },
    {
      label: "🖼️ Image",
      msg: {
        type: "image",
        data: {
          src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80",
          alt: "Mountain landscape",
          caption: "Beautiful mountain view",
        },
      },
    },
    {
      label: "🃏 Card",
      msg: {
        type: "card",
        data: {
          image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=80",
          title: "Getting Started",
          subtitle: "Learn how to use Chativa in your project.",
          buttons: [{ label: "Read Docs", value: "/docs" }, { label: "View Demo", value: "/demo" }],
        },
      },
    },
    {
      label: "🔘 Buttons",
      msg: {
        type: "buttons",
        data: {
          text: "How can I help you today?",
          buttons: [
            { label: "Track my order" },
            { label: "Return a product" },
            { label: "Talk to an agent" },
          ],
        },
      },
    },
    {
      label: "🔘 Buttons (Persistent)",
      msg: {
        type: "buttons",
        data: {
          text: "How can I help you today?",
          buttons: [
            { label: "Track my order" },
            { label: "Return a product" },
            { label: "Talk to an agent" },
          ],
          persistent: true,
        },
      },
    },
    {
      label: "📁 File",
      msg: {
        type: "file",
        data: {
          url: "https://example.com/report.pdf",
          name: "Q4-Report-2024.pdf",
          size: 2457600,
          mimeType: "application/pdf",
        },
      },
    },
    {
      label: "🎬 Video",
      msg: {
        type: "video",
        data: {
          src: "https://www.w3schools.com/html/mov_bbb.mp4",
          poster: "https://www.w3schools.com/html/pic_trulli.jpg",
          caption: "Big Buck Bunny sample clip",
        },
      },
    },
    {
      label: "🎠 Carousel",
      msg: {
        type: "carousel",
        data: {
          cards: [
            {
              image: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=300&q=80",
              title: "Fresh Apples",
              subtitle: "Crispy and delicious",
              buttons: [{ label: "Add to cart", value: "/cart/apple" }],
            },
            {
              image: "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=300&q=80",
              title: "Ripe Bananas",
              subtitle: "Rich in potassium",
              buttons: [{ label: "Add to cart", value: "/cart/banana" }],
            },
            {
              image: "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=300&q=80",
              title: "Juicy Oranges",
              subtitle: "Full of vitamin C",
              buttons: [{ label: "Add to cart", value: "/cart/orange" }],
            },
          ],
        },
      },
    },
  ];

  private _applyHex() {
    if (/^#[0-9a-fA-F]{6}$/.test(this._colorHex)) {
      this._set({ colors: { primary: this._colorHex } });
    }
  }

  render() {
    if (!this._isOpen) {
      return html`
        <button
          class="toggle"
          @click=${() => (this._isOpen = true)}
          title="Open customization panel"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2v-.5c0-.46-.36-.84-.82-.84-.26 0-.5-.1-.68-.28-.18-.18-.28-.42-.28-.68 0-.55.45-1 1-1h1.25C19.25 17 22 14.25 22 10.88 22 5.95 17.52 2 12 2zm-5 9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"
            />
          </svg>
        </button>
      `;
    }

    const { position, size, positionMargin, colors } = this._theme;

    return html`
      <div class="panel">
        <!-- Header -->
        <div class="panel-header">
          <span class="panel-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2v-.5c0-.46-.36-.84-.82-.84-.26 0-.5-.1-.68-.28-.18-.18-.28-.42-.28-.68 0-.55.45-1 1-1h1.25C19.25 17 22 14.25 22 10.88 22 5.95 17.52 2 12 2zm-5 9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"
              />
            </svg>
            Customize
          </span>
          <button
            class="panel-close"
            @click=${() => (this._isOpen = false)}
            title="Minimize"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="panel-body">

          <!-- Position -->
          <div>
            <div class="section-label">Position</div>
            <div class="pos-screen">
              <!-- Row 1 -->
              <button
                class="pos-corner ${position === "top-left" ? "active" : ""}"
                @click=${() => this._set({ position: "top-left" as ButtonPosition })}
              >↖ TL</button>
              <div></div>
              <button
                class="pos-corner ${position === "top-right" ? "active" : ""}"
                @click=${() => this._set({ position: "top-right" as ButtonPosition })}
              >TR ↗</button>
              <!-- Row 2 (spacer) -->
              <div></div><div></div><div></div>
              <!-- Row 3 -->
              <button
                class="pos-corner ${position === "bottom-left" ? "active" : ""}"
                @click=${() => this._set({ position: "bottom-left" as ButtonPosition })}
              >↙ BL</button>
              <div></div>
              <button
                class="pos-corner ${position === "bottom-right" ? "active" : ""}"
                @click=${() => this._set({ position: "bottom-right" as ButtonPosition })}
              >BR ↘</button>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Primary Color -->
          <div>
            <div class="section-label">Primary Color</div>
            <div class="colors">
              ${COLOR_PRESETS.map(
      (c) => html`
                  <button
                    class="color-swatch ${colors.primary === c.value ? "active" : ""}"
                    style="background: ${c.value}; color: ${c.value}"
                    @click=${() => this._set({ colors: { primary: c.value } })}
                    title="${c.label}"
                  ></button>
                `
    )}
            </div>
            <div class="color-row">
              <input
                type="color"
                class="color-native"
                .value=${colors.primary}
                @input=${(e: Event) => {
        const v = (e.target as HTMLInputElement).value;
        this._set({ colors: { primary: v } });
      }}
                title="Custom color"
              />
              <input
                class="color-text"
                type="text"
                .value=${this._colorHex}
                maxlength="7"
                placeholder="#4f46e5"
                @input=${(e: Event) => {
        this._colorHex = (e.target as HTMLInputElement).value;
      }}
                @change=${this._applyHex}
                @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Enter") this._applyHex();
      }}
              />
            </div>
          </div>

          <div class="divider"></div>

          <!-- Button Size -->
          <div>
            <div class="section-label">Button Size</div>
            <div class="toggle-group">
              ${(
        [
          { label: "Small", value: "small" },
          { label: "Medium", value: "medium" },
          { label: "Large", value: "large" },
        ] as { label: string; value: ButtonSize }[]
      ).map(
        (s) => html`
                  <button
                    class="tg-btn ${size === s.value ? "active" : ""}"
                    @click=${() => this._set({ size: s.value })}
                  >
                    ${s.label}
                  </button>
                `
      )}
            </div>
          </div>

          <div class="divider"></div>

          <!-- Edge Margin -->
          <div>
            <div class="section-label">Edge Margin</div>
            <div class="toggle-group">
              ${(["1", "2", "3", "4", "5"] as SpaceLevel[]).map(
        (m) => html`
                  <button
                    class="tg-btn ${positionMargin === m ? "active" : ""}"
                    @click=${() => this._set({ positionMargin: m })}
                  >
                    ${m}
                  </button>
                `
      )}
            </div>
          </div>

          <div class="divider"></div>

          <!-- Features -->
          <div>
            <div class="section-label">Features</div>
            <div class="toggle-group">
              <button
                class="tg-btn ${this._theme.enableSearch !== false ? "active" : ""}"
                @click=${() => this._set({ enableSearch: true })}
              >Search On</button>
              <button
                class="tg-btn ${this._theme.enableSearch === false ? "active" : ""}"
                @click=${() => this._set({ enableSearch: false })}
              >Search Off</button>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Language -->
          <div>
            <div class="section-label">Language</div>
            <div class="toggle-group">
              ${([
        { label: "English", value: "en" },
        { label: "Türkçe", value: "tr" },
      ] as { label: string; value: string }[]).map(
        (l) => html`
                  <button
                    class="tg-btn ${this._lang.startsWith(l.value) ? "active" : ""}"
                    @click=${() => i18n.changeLanguage(l.value)}
                  >${l.label}</button>
                `
      )}
            </div>
          </div>

          <div class="divider"></div>

          <!-- Message Type Examples -->
          <div>
            <div class="section-label">Message Types</div>
            <div class="msg-grid">
              ${this._demoMessages.map(
        ({ label, msg }) => html`
                  <button
                    class="msg-btn"
                    type="button"
                    @click=${() => this._inject(msg)}
                  >${label}</button>
                `
      )}
            </div>
          </div>

          <div class="divider"></div>

          <!-- Generative UI -->
          <div>
            <div class="section-label">Generative UI</div>
            <div class="msg-grid">
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("weather")}>🌤️ Weather</button>
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("alert")}>🔔 Alerts</button>
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("quick-replies")}>⚡ Quick Replies</button>
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("list")}>📝 List</button>
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("table")}>📊 Table</button>
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("rating")}>⭐ Rating</button>
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("progress")}>📈 Progress</button>
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("form")}>📋 Appt. Form</button>
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("date-picker")}>📅 Date Picker</button>
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("chart")}>📊 Chart</button>
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("steps")}>🪜 Steps</button>
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("image-gallery")}>🖼️ Gallery</button>
              <button class="msg-btn" type="button" @click=${() => this._triggerGenUI("typewriter")}>✍️ Typewriter</button>
              <button
                class="msg-btn"
                type="button"
                @click=${() => this._triggerGenUI("genui")}
              >✨ GenUI Demo</button>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Chat Status + Actions -->
          <div>
            <div class="chat-status">
              <span class="status-dot ${this._chatOpen ? "open" : "closed"}"></span>
              Chat is ${this._chatOpen ? "open" : "closed"}
            </div>
          </div>

          <div class="actions">
            <button
              class="btn btn-primary"
              @click=${() => chatStore.getState().toggle()}
            >
              ${this._chatOpen ? "Close Chat" : "Open Chat"}
            </button>
            <button
              class="btn ${this._isFullscreen ? "btn-primary" : "btn-ghost"}"
              @click=${() => chatStore.getState().toggleFullscreen()}
              title="Toggle fullscreen"
            >
              ${this._isFullscreen ? "⛶ Exit" : "⛶ Full"}
            </button>
          </div>

          <div class="actions">
            <button
              class="btn btn-ghost"
              @click=${() => chatStore.getState().setTheme(DEFAULT_THEME)}
              title="Reset to defaults"
              style="flex: 1"
            >
              Reset
            </button>
          </div>

        </div>
      </div>
    `;
  }
}

export default SandboxControls;
