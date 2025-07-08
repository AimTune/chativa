# 📄 Product Requirements Document (PRD) – `Chativa`

---

## 🎯 Objective

Build a **modular**, **themed**, and **adapter-compatible** Web Component chat interface using LitElement, with full integration of **Shoelace UI components** and a **zustand-like global state layer**.

---

## 📁 Project Structure

```
lit-chat/
├── chat-core/             → state, registry, engine
├── chat-ui/               → LitElement components (ChatWidget, Message types)
├── adapters/              → DirectLine, WebSocket, REST, etc.
├── themes/                → Built-in + custom theme support
├── styles/                → Shoelace styling integration
```

---

## 🧠 Global State – Zustand-style Store

### `chat-core/messageStore.ts`

```ts
type ChatMessage = {
  id: string;
  type: string;
  data: any;
  component?: any;
};

let state = {
  messages: [] as ChatMessage[],
  renderedIds: new Set<string>(),
};

const listeners = new Set<() => void>();

export const useMessageStore = {
  addMessage(msg: ChatMessage) {
    if (!state.renderedIds.has(msg.id)) {
      state.messages.push(msg);
      state.renderedIds.add(msg.id);
      listeners.forEach((cb) => cb());
    }
  },
  getMessages: () => state.messages,
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  clear() {
    state.messages = [];
    state.renderedIds.clear();
    listeners.forEach((cb) => cb());
  },
};
```

---

## 📦 Message Type Registry

### `chat-core/messageRegistry.ts`

```ts
const registry = new Map<string, typeof HTMLElement>();

export const useMessageTypeRegistry = {
  register(type: string, component: typeof HTMLElement) {
    registry.set(type, component);
  },
  resolve(type: string) {
    return registry.get(type) ?? DefaultTextMessage;
  },
};
```

---

## 🎨 Theme Support

### `themes/defaultThemes.ts`

```ts
export const defaultThemes = {
  light: {
    "--chat-bg": "#fff",
    "--chat-color": "#1f2937",
    "--chat-bot-bg": "#f3f4f6",
  },
  dark: {
    "--chat-bg": "#1f2937",
    "--chat-color": "#f9fafb",
    "--chat-bot-bg": "#111827",
  },
};
```

### `chat-core/themeStore.ts`

```ts
let currentTheme = {};
const listeners = new Set<() => void>();

export const useThemeStore = {
  setTheme(theme: Record<string, string>) {
    currentTheme = theme;
    listeners.forEach((cb) => cb());
  },
  getTheme: () => currentTheme,
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};
```

---

## 🧩 Chat Engine

### `chat-core/ChatEngine.ts`

```ts
import { useMessageStore } from "./messageStore";
import { useMessageTypeRegistry } from "./messageRegistry";

export class ChatEngine {
  constructor(private adapter: ChatAdapter) {}

  init() {
    this.adapter.onMessage((msg) => {
      const Comp = useMessageTypeRegistry.resolve(msg.type);
      useMessageStore.addMessage({ ...msg, component: Comp });
    });
  }

  send(msg: any) {
    this.adapter.sendMessage(msg);
  }
}
```

---

## 🧱 ChatWidget Component

### `chat-ui/ChatWidget.ts`

```ts
@customElement("chat-iva")
export class ChatWidget extends LitElement {
  private unsubscribe!: () => void;
  private engine = new ChatEngine(new WebSocketAdapter());

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = useMessageStore.subscribe(() => this.requestUpdate());
    this.engine.init();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    super.disconnectedCallback();
  }

  render() {
    const messages = useMessageStore.getMessages();

    return html`
      <div
        part="container"
        style="background: var(--chat-bg); color: var(--chat-color)"
      >
        ${messages.map((msg) => {
          const Comp = msg.component;
          return html`<${Comp} .messageData=${msg.data}></${Comp}>`;
        })}
      </div>
    `;
  }
}
```

---

## 🧾 Message Component Example: `ProductCard`

### `chat-ui/messages/ProductCardMessage.ts`

```ts
export class ProductCardMessage extends BaseMessage {
  render() {
    const { image, name, price } = this.messageData;

    return html`
      <sl-card class="product-card">
        <img slot="image" src="${image}" alt="${name}" />
        <strong>${name}</strong>
        <p>Price: $${price}</p>
        <sl-button variant="primary" @click=${this.addToCart}
          >Add to Cart</sl-button
        >
      </sl-card>
    `;
  }

  private addToCart() {
    // handle click
  }
}
```

Register it:

```ts
useMessageTypeRegistry.register("product-card", ProductCardMessage);
```

---

## 🔌 Adapter Interface

### `chat-core/adapter.ts`

```ts
export interface ChatAdapter {
  sendMessage(message: any): void;
  onMessage(callback: (msg: any) => void): void;
}
```

---

## 💡 Shoelace Integration Notes

- Use Shoelace components (`<sl-card>`, `<sl-button>`, `<sl-input>`) across all message types and layouts.
- Shoelace CSS variables and theming system can be applied alongside chat's theme via CSS custom properties.
- You can inject Shoelace themes by extending `useThemeStore.setTheme()`.

---

## ✅ Summary

| Feature                  | Description                                        |
| ------------------------ | -------------------------------------------------- |
| 🔌 Adapter Architecture  | Pluggable connectors (WebSocket, DirectLine, etc.) |
| 💬 Message Extensibility | Register any message type with a Lit component     |
| 🧠 Global State          | Zustand-like, minimal, no external deps            |
| 🎨 Shoelace Styling      | All UI uses Shoelace components                    |
| ⚡ Optimized Rendering   | Prevents duplicate renders using `renderedIds`     |
| 📦 Component-Based UI    | Uses `BaseMessage` & Lit’s reactive lifecycle      |

---

## 🚀 Example Usage

```html
<chat-iva theme="dark"></chat-iva>

<script type="module">
  import "./chat-ui/ChatWidget.js";
  import { ProductCardMessage } from "./chat-ui/messages/ProductCardMessage.js";
  useMessageTypeRegistry.register("product-card", ProductCardMessage);
</script>
```
