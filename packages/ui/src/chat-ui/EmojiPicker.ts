import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { t } from "i18next";
import i18next from "../i18n/i18n";

interface EmojiCategory {
  label: string;
  icon: string;
  emojis: string[];
}

const CATEGORIES: EmojiCategory[] = [
  {
    label: "Smileys",
    icon: "😀",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃",
      "😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙",
      "🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫",
      "🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬",
      "🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢",
      "🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸",
      "😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲",
      "😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱",
    ],
  },
  {
    label: "Gestures",
    icon: "👍",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞",
      "🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍",
      "👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝",
      "🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂",
    ],
  },
  {
    label: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
      "❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️",
      "✝️","☪️","🕉️","✡️","🔯","🕎","☯️","☦️","🛐","⛎",
    ],
  },
  {
    label: "Animals",
    icon: "🐶",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨",
      "🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔",
      "🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴",
      "🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🐢",
    ],
  },
  {
    label: "Food",
    icon: "🍕",
    emojis: [
      "🍎","🍊","🍋","🍇","🍓","🍒","🍑","🥭","🍍","🥥",
      "🍅","🍆","🥑","🌽","🌶️","🥕","🧅","🧄","🥔","🍠",
      "🍞","🥐","🧀","🍳","🥞","🧇","🥓","🌭","🍔","🍟",
      "🍕","🌮","🌯","🥗","🍝","🍜","🍲","🍛","🍣","🍱",
    ],
  },
  {
    label: "Travel",
    icon: "✈️",
    emojis: [
      "🚗","🚕","🚙","🚌","🏎️","🚓","🚑","🚒","🚐","🛻",
      "🚚","🚛","🚜","🏍️","🛵","🚲","🛴","🛺","🚁","✈️",
      "🚀","🛸","🛶","⛵","🚤","🛥️","🛳️","⛴️","🚢","🏠",
      "🗼","🗽","⛪","🕌","🛕","🕍","⛩️","🏰","🏯","🗺️",
    ],
  },
  {
    label: "Objects",
    icon: "💡",
    emojis: [
      "⌚","📱","💻","⌨️","🖥️","🖨️","📷","📸","📹","🎥",
      "📞","☎️","📺","📻","🎙️","🎚️","🎛️","🧭","⏱️","⏰",
      "💡","🔦","🕯️","🪔","🧲","🔋","💰","💳","💎","🔑",
      "🗝️","🔨","🪓","⛏️","🔧","🔩","🪛","🔫","🧨","💣",
    ],
  },
  {
    label: "Symbols",
    icon: "✨",
    emojis: [
      "✨","🌟","💫","⭐","🌙","☀️","🌈","⚡","❄️","🔥",
      "💥","🌊","🌀","🌪️","🌫️","🌤️","⛅","🌦️","🌧️","⛈️",
      "❓","❗","💯","🔴","🟠","🟡","🟢","🔵","🟣","⚫",
      "⚪","🟤","🔶","🔷","🔸","🔹","🔺","🔻","💠","🔘",
    ],
  },
];

@customElement("emoji-picker")
export class EmojiPicker extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .picker {
      width: 300px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* Category tabs */
    .tabs {
      display: flex;
      padding: 8px 8px 0;
      gap: 2px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .tabs::-webkit-scrollbar {
      display: none;
    }

    .tab {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.1s;
      position: relative;
    }

    .tab:hover {
      background: #e2e8f0;
    }

    .tab.active {
      background: #ffffff;
    }

    .tab.active::after {
      content: "";
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--chativa-primary-color, #4f46e5);
      border-radius: 2px 2px 0 0;
    }

    /* Search */
    .search-wrap {
      padding: 8px 10px 6px;
      border-bottom: 1px solid #f1f5f9;
    }

    .search-input {
      width: 100%;
      height: 30px;
      padding: 0 10px;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.8125rem;
      color: #0f172a;
      background: #f8fafc;
      outline: none;
      box-sizing: border-box;
      font-family: inherit;
      transition: border-color 0.15s;
    }

    .search-input:focus {
      border-color: var(--chativa-primary-color, #4f46e5);
    }

    .search-input::placeholder {
      color: #94a3b8;
    }

    /* Emoji grid */
    .grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      padding: 8px;
      gap: 2px;
      max-height: 200px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #e2e8f0 transparent;
    }

    .grid::-webkit-scrollbar {
      width: 4px;
    }

    .grid::-webkit-scrollbar-track {
      background: transparent;
    }

    .grid::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 4px;
    }

    .emoji-btn {
      width: 100%;
      aspect-ratio: 1;
      border: none;
      background: transparent;
      border-radius: 6px;
      font-size: 1.25rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: background 0.1s, transform 0.1s;
      padding: 0;
    }

    .emoji-btn:hover {
      background: #f1f5f9;
      transform: scale(1.2);
    }

    .emoji-btn:active {
      transform: scale(0.9);
    }

    .no-results {
      grid-column: 1 / -1;
      padding: 20px;
      text-align: center;
      font-size: 0.8125rem;
      color: #94a3b8;
    }
  `;

  @state() private _activeCategory = 0;
  @state() private _search = "";
  private _onLangChange = () => { this.requestUpdate(); };

  override connectedCallback() {
    super.connectedCallback();
    i18next.on("languageChanged", this._onLangChange);
  }

  override disconnectedCallback() {
    i18next.off("languageChanged", this._onLangChange);
    super.disconnectedCallback();
  }

  private _onSearch(e: Event) {
    this._search = (e.target as HTMLInputElement).value;
  }

  private _selectEmoji(emoji: string) {
    this.dispatchEvent(
      new CustomEvent<string>("emoji-select", {
        detail: emoji,
        bubbles: true,
        composed: true,
      })
    );
  }

  private get _visibleEmojis(): string[] {
    const q = this._search.trim();
    if (q) {
      // Simple search: look in all categories
      return CATEGORIES.flatMap((c) => c.emojis).filter((e) => e.includes(q));
    }
    return CATEGORIES[this._activeCategory].emojis;
  }

  render() {
    const emojis = this._visibleEmojis;

    return html`
      <div class="picker">
        <div class="tabs">
          ${CATEGORIES.map(
            (cat, i) => html`
              <button
                class="tab ${i === this._activeCategory && !this._search ? "active" : ""}"
                @click=${() => { this._activeCategory = i; this._search = ""; }}
                title=${cat.label}
              >${cat.icon}</button>
            `
          )}
        </div>

        <div class="search-wrap">
          <input
            class="search-input"
            type="text"
            placeholder="${t("emojiPicker.searchPlaceholder")}"
            .value=${this._search}
            @input=${this._onSearch}
            autocomplete="off"
          />
        </div>

        <div class="grid">
          ${emojis.length === 0
            ? html`<span class="no-results">${t("emojiPicker.noResults")}</span>`
            : emojis.map(
                (emoji) => html`
                  <button
                    class="emoji-btn"
                    type="button"
                    @click=${() => this._selectEmoji(emoji)}
                  >${emoji}</button>
                `
              )}
        </div>
      </div>
    `;
  }
}

export default EmojiPicker;
