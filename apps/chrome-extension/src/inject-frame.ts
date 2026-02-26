/**
 * inject-frame.ts — Chativa widget host for the preview iframe.
 *
 * Runs as a normal extension page (ESM, full browser APIs).
 * Receives theme updates via postMessage from the content script.
 */

import { ConnectorRegistry, chatStore, type ThemeConfig, type DeepPartial } from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";
import "@chativa/ui";

const CONNECTOR_NAME = "ext-preview";

// Register connector
ConnectorRegistry.register(new DummyConnector({ name: CONNECTOR_NAME, replyDelay: 600 }));

// Mount widget elements
const button = document.createElement("chat-bot-button");
const widget = document.createElement("chat-iva") as HTMLElement & { connector: string };
widget.connector = CONNECTOR_NAME;
document.body.appendChild(button);
document.body.appendChild(widget);

// Listen for theme updates from the content script
window.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data as { type: string; theme?: ThemeConfig };
  if (msg?.type === "chativa-theme" && msg.theme) {
    chatStore.getState().setTheme(msg.theme as DeepPartial<ThemeConfig>);
  }
});

// Signal to the content script that this frame is ready
window.parent.postMessage({ type: "chativa-frame-ready" }, "*");
