import { describe, it, expect, afterEach, vi } from "vitest";
import { mount, enableAutoUnmount } from "@vue/test-utils";
import { createApp } from "vue";
import {
  ConnectorRegistry,
  ExtensionRegistry,
  chatStore,
  i18next,
  type IExtension,
} from "@chativa/core";
import { ChativaPlugin, applyChativaOptions } from "../plugin";
import { ChatIva } from "../ChatIva";
import { ChatBotButton } from "../ChatBotButton";
import { GenUIMessage } from "../GenUIMessage";
import { loadChativaUi } from "../internal/loadChativaUi";
import { makeFakeConnector, waitForElement } from "./helpers";

enableAutoUnmount(afterEach);

describe("ChativaPlugin", () => {
  it("registers ChatIva, ChatBotButton and GenUIMessage as global components", () => {
    const app = createApp({ render: () => null });
    app.use(ChativaPlugin);
    expect(app.component("ChatIva")).toBe(ChatIva);
    expect(app.component("ChatBotButton")).toBe(ChatBotButton);
    expect(app.component("GenUIMessage")).toBe(GenUIMessage);
  });

  it("skips global registration with registerComponents: false", () => {
    const app = createApp({ render: () => null });
    app.use(ChativaPlugin, { registerComponents: false });
    expect(app.component("ChatIva")).toBeUndefined();
  });

  it("lets a template use the globally registered <ChatIva />", async () => {
    const wrapper = mount(
      { template: "<ChatIva />" },
      {
        attachTo: document.body,
        global: {
          plugins: [[ChativaPlugin, { connector: makeFakeConnector("vue-plugin-connector-tpl") }]],
        },
      },
    );
    await waitForElement(wrapper, "chat-iva");
    expect(chatStore.getState().activeConnector).toBe("vue-plugin-connector-tpl");
  });

  it("auto-registers an IConnector instance and activates it", () => {
    createApp({ render: () => null }).use(ChativaPlugin, {
      connector: makeFakeConnector("vue-plugin-connector"),
    });
    expect(ConnectorRegistry.has("vue-plugin-connector")).toBe(true);
    expect(chatStore.getState().activeConnector).toBe("vue-plugin-connector");
    ConnectorRegistry.unregister("vue-plugin-connector");
  });

  it("installs extensions once", () => {
    const install = vi.fn();
    const extension: IExtension = { name: "vue-plugin-extension", version: "1.0.0", install };

    applyChativaOptions({ extensions: [extension] });
    applyChativaOptions({ extensions: [extension] });

    expect(install).toHaveBeenCalledTimes(1);
    expect(ExtensionRegistry.has("vue-plugin-extension")).toBe(true);
    ExtensionRegistry.uninstall("vue-plugin-extension");
  });

  it("applies theme overrides", () => {
    applyChativaOptions({ theme: { colors: { primary: "#42b883" } } });
    expect(chatStore.getState().theme.colors.primary).toBe("#42b883");
  });

  it("defers locale and i18n overrides until i18next is initialised", () => {
    const wasInitialized = i18next.isInitialized;
    const on = vi.spyOn(i18next, "on");
    (i18next as { isInitialized: boolean }).isInitialized = false;
    try {
      applyChativaOptions({ locale: "tr", i18n: { header: { title: "Deferred" } } });
      const events = on.mock.calls.map(([event]) => event);
      expect(events.filter((e) => e === "initialized")).toHaveLength(2);
      expect(events).toContain("languageChanged");
    } finally {
      (i18next as { isInitialized: boolean }).isInitialized = wasInitialized;
      on.mockRestore();
    }
  });

  it("applies locale and i18n overrides immediately once i18next is initialised", async () => {
    // `@chativa/ui` initialises the shared i18next instance on import.
    await loadChativaUi();
    expect(i18next.isInitialized).toBe(true);

    applyChativaOptions({ locale: "tr", i18n: { header: { title: "Vue Bot" } } });
    expect(i18next.language).toBe("tr");
    expect(i18next.t("header.title")).toBe("Vue Bot");

    // Overrides survive a language switch.
    await i18next.changeLanguage("en");
    expect(i18next.t("header.title")).toBe("Vue Bot");
  });
});
