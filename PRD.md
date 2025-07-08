# 📄 Product Requirements Document (PRD) – **Chativa**

---

## 🎯 Objective

Develop **Chativa**, a **modular**, **themeable**, **adapter-extensible** web component chat widget based on LitElement. It should integrate **Shoelace UI** components and manage global state with a minimal Zustand-like store. Users can **register custom message types and adapters externally**, enabling flexible extension without modifying core code.

---

## 🔧 Architecture Overview

### Project Structure

```
src/
├── chat-core/             # Global state, message registry, chat engine
├── chat-ui/               # LitElement components (ChatWidget, message types)
├── adapters/              # Built-in adapters (DirectLine, WebSocket, REST, etc.)
├── themes/                # Default and custom themes
├── styles/                # Shoelace styling integration
```

---

## 🧠 Global State Management (`chat-core/messageStore.ts`)

- Uses a Zustand-inspired minimal store.
- Stores messages with a unique ID set to **prevent duplicate renders**.
- Supports subscriptions for UI updates.

```ts
type ChatMessage = {
  id: string;
  type: string;
  data: any;
  component?: typeof HTMLElement;
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

## 📦 Message Type Registry (`chat-core/messageRegistry.ts`)

- Registry stores message type keys and their corresponding LitElement components.
- Supports external registration of message components.

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

## 🖌️ Theme Support (`chat-core/themeStore.ts`)

- Holds current theme variables.
- Supports subscriptions for dynamic theme updates.

```ts
let currentTheme: Record<string, string> = {};

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

## 🧩 Chat Engine (`chat-core/ChatEngine.ts`)

- Bridges between the adapter and UI state.
- Listens for incoming messages and adds them to the global message store.
- Sends outgoing messages via the adapter.

```ts
import { useMessageStore } from "./messageStore";
import { useMessageTypeRegistry } from "./messageRegistry";

export class ChatEngine {
  constructor(private adapter: ChatAdapter) {}

  init() {
    this.adapter.onMessage((msg) => {
      const Component = useMessageTypeRegistry.resolve(msg.type);
      useMessageStore.addMessage({ ...msg, component: Component });
    });
  }

  send(msg: any) {
    this.adapter.sendMessage(msg);
  }
}
```

---

## 🔌 Adapter Interface & Registration (`chat-core/adapter.ts`)

- Defines adapter contract for sending/receiving messages.
- Supports **external adapter registration** so users can add their own adapters dynamically.

```ts
export interface ChatAdapter {
  sendMessage(message: BaseMessage): void;
  onMessage(callback: (msg: BaseMessage) => void): void;
}

const adapterRegistry = new Map<string, ChatAdapter>();

export const useAdapterRegistry = {
  register(name: string, adapter: ChatAdapter) {
    adapterRegistry.set(name, adapter);
  },
  get(name: string) {
    return adapterRegistry.get(name);
  },
};
```

---

## 🧱 ChatWidget Component (`chat-ui/ChatWidget.ts`)

- Uses LitElement, subscribes to message and theme stores.
- Renders messages using their registered components.
- Accepts adapter selection and exposes APIs for external adapter and message registrations.

```ts
@customElement("chat-iva")
export class ChatWidget extends LitElement {
  private unsubscribeMessages!: () => void;
  private unsubscribeTheme!: () => void;
  private engine!: ChatEngine;

  @property({ type: String }) adapterName = "default";

  connectedCallback() {
    super.connectedCallback();

    // Get adapter instance from registry (can be custom-registered externally)
    const adapter = useAdapterRegistry.get(this.adapterName);
    if (!adapter) throw new Error(`Adapter ${this.adapterName} not found`);

    this.engine = new ChatEngine(adapter);
    this.engine.init();

    this.unsubscribeMessages = useMessageStore.subscribe(() =>
      this.requestUpdate()
    );
    this.unsubscribeTheme = useThemeStore.subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    this.unsubscribeMessages?.();
    this.unsubscribeTheme?.();
    super.disconnectedCallback();
  }

  render() {
    const messages = useMessageStore.getMessages();
    const theme = useThemeStore.getTheme();

    return html`
      <div
        part="container"
        style=${Object.entries(theme)
          .map(([k, v]) => `${k}: ${v};`)
          .join(" ")}
      >
        ${messages.map(
          (msg) =>
            html`<${msg.component} .messageData=${msg.data}></${msg.component}>`
        )}
      </div>
    `;
  }
}
```

---

## 🛠️ Example: Registering Custom Message & Adapter Externally

```ts
import { useMessageTypeRegistry } from "./chat-core/messageRegistry";
import { useAdapterRegistry } from "./chat-core/adapter";

class CustomMessage extends BaseMessage {
  /* ... */
}
class CustomAdapter implements ChatAdapter {
  /* ... */
}

// Register message type
useMessageTypeRegistry.register("custom-message", CustomMessage);

// Register adapter
const myAdapter = new CustomAdapter();
useAdapterRegistry.register("my-adapter", myAdapter);

// Then use in HTML
// <chat-iva adapter-name="my-adapter"></chat-iva>
```

---

## 🎨 Shoelace Integration

- All UI parts use Shoelace components like `<sl-card>`, `<sl-button>`, etc.
- Chat theme and Shoelace themes combined through CSS custom properties.

---

## ✅ Summary

| Feature                   | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| Modular Architecture      | External registration of adapters & messages             |
| LitElement + Shoelace UI  | Modern, accessible components                            |
| Zustand-like Global Store | Efficient message state with duplicate render prevention |
| Flexible Theming          | Dynamic theme switching with CSS variables               |
| Adapter System            | Plug & play backend connectors                           |
| Optimized Rendering       | Only new messages cause re-render                        |
