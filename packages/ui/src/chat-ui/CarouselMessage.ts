import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { MessageTypeRegistry, type MessageSender, type MessageAction } from "@chativa/core";

/**
 * Carousel message component.
 * Renders a horizontal scrollable row of rich cards with prev/next navigation.
 * Card buttons dispatch `chat-action` events (bubbles + composed).
 *
 * Register a message of type "carousel" with:
 *   {
 *     cards: [
 *       {
 *         image?: "https://...",
 *         title: "Card Title",
 *         subtitle?: "Supporting text",
 *         buttons?: [{ label: "Learn More", value?: "/learn-more" }]
 *       }
 *     ]
 *   }
 */

interface CarouselCard {
  image?: string;
  title: string;
  subtitle?: string;
  buttons?: MessageAction[];
}

@customElement("carousel-message")
export class CarouselMessage extends LitElement {
  static override styles = css`
    :host { display: block; }

    .message {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      max-width: 100%;
      margin-bottom: 2px;
    }

    .message.bot { margin-right: auto; }
    .message.user { margin-left: auto; flex-direction: row-reverse; }

    .avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #ede9fe;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .avatar.hidden { visibility: hidden; }
    .avatar svg { width: 16px; height: 16px; color: #7c3aed; }

    .content {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      flex: 1;
    }

    /* ── Navigation row ── */
    .carousel-nav {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .nav-btn {
      flex-shrink: 0;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 1.5px solid #e2e8f0;
      background: #ffffff;
      color: #475569;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
      transition: background 0.15s, border-color 0.15s, opacity 0.15s;
      padding: 0;
    }

    .nav-btn:hover:not(:disabled) {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .nav-btn:disabled {
      opacity: 0.3;
      cursor: default;
      box-shadow: none;
    }

    .nav-btn svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    /* ── Carousel track ── */
    .carousel {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      flex: 1;
      min-width: 0;
    }

    /* Hide scrollbar */
    .carousel::-webkit-scrollbar { display: none; }
    .carousel { scrollbar-width: none; }

    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      width: 200px;
      flex-shrink: 0;
      scroll-snap-align: start;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    }

    .card-image {
      width: 100%;
      height: 120px;
      object-fit: cover;
      display: block;
    }

    .card-image-skeleton {
      width: 100%;
      height: 120px;
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .card-body {
      padding: 10px 12px;
    }

    .card-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 3px;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-subtitle {
      font-size: 0.75rem;
      color: #64748b;
      margin: 0;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-divider {
      height: 1px;
      background: #f1f5f9;
    }

    .card-actions { display: flex; flex-direction: column; }

    .card-btn {
      background: none;
      border: none;
      border-bottom: 1px solid #f1f5f9;
      padding: 8px 12px;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--chativa-primary-color, #4f46e5);
      cursor: pointer;
      text-align: center;
      font-family: inherit;
      transition: background 0.15s;
    }

    .card-btn:last-child { border-bottom: none; }
    .card-btn:hover { background: #f8fafc; }
    .card-btn:active { background: #f1f5f9; }

    /* ── Dot indicators ── */
    .dots {
      display: flex;
      gap: 5px;
      justify-content: center;
    }

    .dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #e2e8f0;
      transition: background 0.2s, transform 0.2s;
    }

    .dot.active {
      background: var(--chativa-primary-color, #4f46e5);
      transform: scale(1.3);
    }

    .time {
      font-size: 0.6875rem;
      color: #94a3b8;
      padding: 0 4px;
    }
  `;

  @property({ type: Object }) messageData: Record<string, unknown> = {};
  @property({ type: String }) sender: MessageSender = "bot";
  @property({ type: Number }) timestamp = 0;
  @property({ type: Boolean }) hideAvatar = false;

  @state() private _currentIndex = 0;
  @state() private _loadedImages = new Set<number>();

  private get _time(): string {
    if (!this.timestamp) return "";
    return new Date(this.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private _scrollTo(index: number) {
    const carousel = this.renderRoot.querySelector(".carousel") as HTMLElement | null;
    if (!carousel) return;
    const cards = carousel.querySelectorAll<HTMLElement>(".card");
    const card = cards[index];
    if (!card) return;
    this._currentIndex = index;
    carousel.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
  }

  private _onButtonClick(action: MessageAction) {
    this.dispatchEvent(
      new CustomEvent<string>("chat-action", {
        detail: action.value ?? action.label,
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onImageLoad(index: number) {
    this._loadedImages = new Set(this._loadedImages).add(index);
  }

  render() {
    const isUser = this.sender === "user";
    const cards = (this.messageData?.cards ?? []) as CarouselCard[];
    const total = cards.length;
    const atStart = this._currentIndex === 0;
    const atEnd = this._currentIndex >= total - 1;

    return html`
      <div class="message ${isUser ? "user" : "bot"}">
        ${!isUser
          ? html`
              <div class="avatar ${this.hideAvatar ? "hidden" : ""}">
                <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="8" width="14" height="12" rx="2.5" />
                  <circle cx="9.5" cy="13" r="1.5" fill="white" />
                  <circle cx="14.5" cy="13" r="1.5" fill="white" />
                  <path d="M9.5 17c.5.5 1.4.8 2.5.8s2-.3 2.5-.8" stroke="white" stroke-width="1.2" stroke-linecap="round" fill="none" />
                </svg>
              </div>
            `
          : nothing}
        <div class="content">
          <div class="carousel-nav">
            <!-- Prev button -->
            <button
              class="nav-btn"
              ?disabled=${atStart}
              @click=${() => this._scrollTo(this._currentIndex - 1)}
              title="Previous"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
            </button>

            <!-- Scrollable track -->
            <div class="carousel">
              ${cards.map(
                (card, i) => html`
                  <div class="card">
                    ${card.image
                      ? html`
                          ${!this._loadedImages.has(i)
                            ? html`<div class="card-image-skeleton"></div>`
                            : nothing}
                          <img
                            class="card-image"
                            src="${card.image}"
                            alt="${card.title}"
                            style="${this._loadedImages.has(i) ? "" : "display:none"}"
                            @load=${() => this._onImageLoad(i)}
                          />
                        `
                      : nothing}
                    <div class="card-body">
                      <p class="card-title" title="${card.title}">${card.title}</p>
                      ${card.subtitle
                        ? html`<p class="card-subtitle">${card.subtitle}</p>`
                        : nothing}
                    </div>
                    ${card.buttons && card.buttons.length > 0
                      ? html`
                          <div class="card-divider"></div>
                          <div class="card-actions">
                            ${card.buttons.map(
                              (btn) => html`
                                <button
                                  class="card-btn"
                                  type="button"
                                  @click=${() => this._onButtonClick(btn)}
                                >${btn.label}</button>
                              `
                            )}
                          </div>
                        `
                      : nothing}
                  </div>
                `
              )}
            </div>

            <!-- Next button -->
            <button
              class="nav-btn"
              ?disabled=${atEnd}
              @click=${() => this._scrollTo(this._currentIndex + 1)}
              title="Next"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </button>
          </div>

          <!-- Dot indicators (only when > 1 card) -->
          ${total > 1 ? html`
            <div class="dots">
              ${cards.map(
                (_, i) => html`
                  <div
                    class="dot ${i === this._currentIndex ? "active" : ""}"
                    @click=${() => this._scrollTo(i)}
                    style="cursor: pointer"
                  ></div>
                `
              )}
            </div>
          ` : nothing}

          ${this._time ? html`<span class="time">${this._time}</span>` : nothing}
        </div>
      </div>
    `;
  }
}

MessageTypeRegistry.register(
  "carousel",
  CarouselMessage as unknown as typeof HTMLElement
);

export default CarouselMessage;
