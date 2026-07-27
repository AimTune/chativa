import type { RefObject } from "react";
import type WebView from "react-native-webview";
import type { BridgeInMessage } from "./types";

/**
 * Send a command into an already-mounted `<ChativaWebView>` (e.g. a live
 * theme update). Simulates the `message` event the bootstrap page's own
 * bridge listener expects — see `buildBootstrapHtml`'s `handleInbound`.
 */
export function sendToChativaWebView(ref: RefObject<WebView | null>, message: BridgeInMessage): void {
  const dataJson = JSON.stringify(message);
  ref.current?.injectJavaScript(
    `document.dispatchEvent(new MessageEvent("message", { data: ${JSON.stringify(dataJson)} })); true;`,
  );
}
