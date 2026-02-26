/**
 * inject-widget.ts — Loaded as <script type="module"> in the host page.
 *
 * Registers Chativa custom elements and a demo connector, then exposes
 * chatStore on window so the extension popup can call setTheme() via
 * chrome.scripting.executeScript({ world: "MAIN" }).
 *
 * Elements (<chat-bot-button>, <chat-iva>) are created by the popup's
 * injected function — not here — matching the CDN usage pattern:
 *   <script type="module" src="chativa.js"></script>
 *   <chat-bot-button></chat-bot-button>
 *   <chat-iva connector="dummy"></chat-iva>
 */

import { ConnectorRegistry, chatStore } from "@chativa/core";
import { DummyConnector } from "@chativa/connector-dummy";
import "@chativa/ui";

try {
  ConnectorRegistry.register(new DummyConnector({ name: "dummy", replyDelay: 600 }));
} catch { /* already registered */ }

// Expose for popup's executeScript(world:"MAIN") calls
(window as Record<string, unknown>).__chativa = { chatStore };
