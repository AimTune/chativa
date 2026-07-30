import { describe, it, expect, vi } from "vitest";
import type WebView from "react-native-webview";
import { sendToChativaWebView } from "../postMessage";
import type { BridgeInMessage } from "../types";

function fakeRef() {
  const injectJavaScript = vi.fn();
  return {
    ref: { current: { injectJavaScript } as unknown as WebView },
    injectJavaScript,
  };
}

describe("sendToChativaWebView", () => {
  it("injects a MessageEvent carrying the JSON-encoded message", () => {
    const { ref, injectJavaScript } = fakeRef();
    const msg: BridgeInMessage = { type: "send_message", payload: { text: "hi", markdown: true } };
    sendToChativaWebView(ref, msg);

    expect(injectJavaScript).toHaveBeenCalledTimes(1);
    const injected = injectJavaScript.mock.calls[0][0] as string;
    expect(injected).toContain('new MessageEvent("message"');
    expect(injected).toContain(JSON.stringify(JSON.stringify(msg)));
  });

  it("is a no-op on an empty ref", () => {
    expect(() => sendToChativaWebView({ current: null }, { type: "open_widget" })).not.toThrow();
  });
});
