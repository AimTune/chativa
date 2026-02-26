import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { sectionStyles, injectMessage } from "../sandboxShared";

const DEMO_MESSAGES: Array<{ label: string; msg: Record<string, unknown> }> = [
  {
    label: "💬 Text",
    msg: { type: "text", data: { text: "Hello! This is a **text** message with _markdown_ support." } },
  },
  {
    label: "⚡ Quick Reply",
    msg: {
      type: "quick-reply",
      data: { text: "Which option do you prefer?", actions: [{ label: "Option A" }, { label: "Option B" }, { label: "Option C" }] },
    },
  },
  {
    label: "🖼️ Image",
    msg: {
      type: "image",
      data: { src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80", alt: "Mountain", caption: "Beautiful mountain view" },
    },
  },
  {
    label: "🃏 Card",
    msg: {
      type: "card",
      data: {
        image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=80",
        title: "Getting Started",
        subtitle: "Learn how to use Chativa.",
        buttons: [{ label: "Read Docs", value: "/docs" }, { label: "View Demo", value: "/demo" }],
      },
    },
  },
  {
    label: "🔘 Buttons",
    msg: {
      type: "buttons",
      data: { text: "How can I help you?", buttons: [{ label: "Track order" }, { label: "Return" }, { label: "Agent" }] },
    },
  },
  {
    label: "🔘 Persistent",
    msg: {
      type: "buttons",
      data: { text: "Pick an option:", buttons: [{ label: "Option A" }, { label: "Option B" }], persistent: true },
    },
  },
  {
    label: "📁 File",
    msg: { type: "file", data: { url: "https://example.com/report.pdf", name: "Q4-Report-2024.pdf", size: 2457600, mimeType: "application/pdf" } },
  },
  {
    label: "🎬 Video",
    msg: { type: "video", data: { src: "https://www.w3schools.com/html/mov_bbb.mp4", poster: "https://www.w3schools.com/html/pic_trulli.jpg", caption: "Sample clip" } },
  },
  {
    label: "🎠 Carousel",
    msg: {
      type: "carousel",
      data: {
        cards: [
          { image: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=300&q=80", title: "Fresh Apples",  subtitle: "Crispy and delicious",  buttons: [{ label: "Add to cart", value: "/cart/apple"  }] },
          { image: "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=300&q=80", title: "Ripe Bananas",  subtitle: "Rich in potassium",   buttons: [{ label: "Add to cart", value: "/cart/banana" }] },
          { image: "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=300&q=80", title: "Juicy Oranges", subtitle: "Full of vitamin C",   buttons: [{ label: "Add to cart", value: "/cart/orange" }] },
        ],
      },
    },
  },
];

@customElement("sandbox-messages-section")
export class MessagesSection extends LitElement {
  static override styles = [sectionStyles];

  @state() private _open = false;

  render() {
    return html`
      <div class="section-header" @click=${() => (this._open = !this._open)}>
        <span class="section-label">Message Types</span>
        <svg class="chevron ${this._open ? "open" : ""}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      ${this._open ? html`
        <div class="section-body">
          <div class="msg-grid">
            ${DEMO_MESSAGES.map(({ label, msg }) => html`
              <button class="msg-btn" type="button" @click=${() => injectMessage(msg)}>${label}</button>
            `)}
          </div>
        </div>
      ` : nothing}
    `;
  }
}
