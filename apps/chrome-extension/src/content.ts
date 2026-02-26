/**
 * content.ts — Chativa content script (tiny bridge, no widget bundle).
 *
 * Runs in the ISOLATED world and forwards messages from the popup to the
 * widget (which lives in MAIN world, injected as inject-main.js).
 *
 * Message protocol (popup → content script → widget):
 *   chativa-ping          → { injected: boolean }
 *   chativa-update-theme  → (no response) — forwards theme via postMessage
 *   chativa-remove        → (no response) — triggers widget self-removal
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _win = window as any;
const GUARD = "__chativa_ext_cs__";

if (!_win[GUARD]) {
  _win[GUARD] = true;

  chrome.runtime.onMessage.addListener(
    (msg: { type: string; theme?: unknown }, _sender, sendResponse) => {
      if (msg.type === "chativa-ping") {
        // Check for the injected widget elements (shared DOM, visible from isolated world)
        sendResponse({ injected: !!document.querySelector("chat-bot-button") });
        return;
      }
      if (msg.type === "chativa-update-theme") {
        window.postMessage({ type: "chativa-theme", theme: msg.theme ?? {} }, "*");
        return;
      }
      if (msg.type === "chativa-remove") {
        window.postMessage({ type: "chativa-remove-widget" }, "*");
      }
    }
  );
}
