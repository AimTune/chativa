/**
 * inject-main.ts — Widget initialization, injected into the host page's
 * MAIN world via chrome.scripting.executeScript({ files: ["inject-main.js"], world: "MAIN" }).
 *
 * Because it is extension-injected code, it bypasses the page's CSP entirely.
 * Handles theme updates and removal via window.postMessage from the content script.
 */

import { ConnectorRegistry, chatStore } from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";
import "@chativa/ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _win = window as any;

if (!_win.__chativa_injected__) {
  _win.__chativa_injected__ = true;

  try {
    ConnectorRegistry.register(new DummyConnector({ name: "dummy", replyDelay: 600 }));
  } catch { /* already registered */ }

  if (!document.querySelector("chat-bot-button")) {
    document.body.appendChild(document.createElement("chat-bot-button"));
    const w = document.createElement("chat-iva");
    w.setAttribute("connector", "dummy");
    document.body.appendChild(w);
  }

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
      _win.__chativa_injected__ = false;
    }
  });
}
