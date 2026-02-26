/**
 * chativa-cdn.ts — Extension CDN entry point.
 *
 * Served by the sandbox dev server:
 *   http://localhost:5173/src/chativa-cdn.ts
 *
 * Loaded as <script type="module"> by the content script.
 * Creates widget elements, handles theme updates via postMessage.
 */

import { ConnectorRegistry, chatStore } from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";
import "@chativa/ui";

try {
  ConnectorRegistry.register(new DummyConnector({ name: "dummy", replyDelay: 600 }));
} catch { /* already registered */ }

// Create elements directly (matches the CDN snippet pattern)
if (!document.querySelector("chat-bot-button")) {
  document.body.appendChild(document.createElement("chat-bot-button"));
  const w = document.createElement("chat-iva");
  w.setAttribute("connector", "dummy");
  document.body.appendChild(w);
}

// Receive theme updates and remove commands from the content script
window.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data as { type?: string; theme?: unknown };
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "chativa-theme" && msg.theme) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatStore.getState().setTheme(msg.theme as any);
  }
  if (msg.type === "chativa-remove-widget") {
    document.querySelector("chat-bot-button")?.remove();
    document.querySelector("chat-iva")?.remove();
  }
});

// Signal to the content script that the widget is ready
window.postMessage({ type: "chativa-widget-ready" }, "*");
