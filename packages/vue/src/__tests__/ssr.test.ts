// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { ConnectorRegistry, chatStore, type IConnector } from "@chativa/core";
import {
  ChativaPlugin,
  ChatIva,
  ChatBotButton,
  GenUIMessage,
  useChat,
  useMessages,
  useGenUIStream,
} from "../index";

function makeFakeConnector(name: string): IConnector {
  return {
    name,
    async connect() {},
    async disconnect() {},
    async sendMessage() {},
    onMessage() {},
  };
}

describe("server rendering (Nuxt / Vite SSR)", () => {
  it("has no browser window in this environment", () => {
    // Note: `customElements` may exist here — Lit's Node build installs a
    // server shim for it — which is why the wrappers gate on `window` too.
    expect(typeof window).toBe("undefined");
  });

  it("renders every wrapper as an empty placeholder without touching customElements", async () => {
    const app = createSSRApp({
      setup() {
        const chat = useChat();
        const { messages } = useMessages();
        const { streams } = useGenUIStream();
        return () =>
          h("div", [
            h(ChatBotButton),
            h(ChatIva, { connector: makeFakeConnector("vue-ssr-connector"), fullscreenOnly: true }),
            h(GenUIMessage, { messageData: { chunks: [], streamingComplete: true } }),
            h("p", `${chat.isOpened.value}/${messages.value.length}/${streams.value.length}`),
          ]);
      },
    });
    app.use(ChativaPlugin, {
      connector: makeFakeConnector("vue-ssr-plugin-connector"),
      theme: { colors: { primary: "#000001" } },
      locale: "tr",
    });

    const html = await renderToString(app);

    expect(html).toContain("<!---->");
    expect(html).not.toContain("<chat-iva");
    expect(html).not.toContain("<chat-bot-button");
    expect(html).toContain("<p>false/0/0</p>");

    // The process-wide singletons are left alone on the server.
    expect(ConnectorRegistry.has("vue-ssr-connector")).toBe(false);
    expect(ConnectorRegistry.has("vue-ssr-plugin-connector")).toBe(false);
    expect(chatStore.getState().theme.colors.primary).not.toBe("#000001");
    expect(chatStore.getState().isFullscreen).toBe(false);
  });
});
