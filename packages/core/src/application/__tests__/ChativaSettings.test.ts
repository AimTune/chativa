import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import i18next from "i18next";
import type { IConnector } from "../../domain/ports/IConnector";
import type { ChativaSettings } from "../ChativaSettings";

/**
 * `applyGlobalSettings()` keeps a module-level "already applied" flag, so each
 * test loads a fresh copy of the module (and of the stores/registries it
 * writes to) via `vi.resetModules()` + dynamic import. i18next is an external
 * dependency and stays the same shared instance across reloads.
 */
async function load(settings: ChativaSettings | undefined) {
  window.chativaSettings = settings;
  vi.resetModules();
  const { applyGlobalSettings } = await import("../ChativaSettings");
  const { default: chatStore } = await import("../stores/ChatStore");
  const { ConnectorRegistry } = await import("../registries/ConnectorRegistry");
  return { applyGlobalSettings, chatStore, ConnectorRegistry };
}

function fakeConnector(name: string): IConnector {
  return {
    name,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn(),
    setContext: vi.fn(),
  };
}

describe("applyGlobalSettings", () => {
  beforeAll(async () => {
    await i18next.init({
      lng: "en",
      fallbackLng: "en",
      showSupportNotice: false,
      resources: {
        en: { translation: { header: { title: "Default" } } },
        tr: { translation: { header: { title: "Varsayilan" } } },
      },
    });
  });

  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  afterEach(() => {
    delete window.chativaSettings;
    // Drop the listeners each test registered so they don't leak into the next.
    i18next.off("languageChanged");
    i18next.off("initialized");
  });

  it("is a no-op when window.chativaSettings is not set", async () => {
    const { applyGlobalSettings, chatStore } = await load(undefined);
    const before = chatStore.getState();
    applyGlobalSettings();
    expect(chatStore.getState().activeConnector).toBe(before.activeConnector);
    expect(chatStore.getState().theme).toBe(before.theme);
  });

  it("activates a connector given by name", async () => {
    const { applyGlobalSettings, chatStore } = await load({ connector: "directline" });
    applyGlobalSettings();
    expect(chatStore.getState().activeConnector).toBe("directline");
  });

  it("registers and activates an IConnector instance, injecting the context", async () => {
    const connector = fakeConnector("custom");
    const { applyGlobalSettings, chatStore, ConnectorRegistry } = await load({ connector });
    applyGlobalSettings();
    expect(ConnectorRegistry.get("custom")).toBe(connector);
    expect(connector.setContext).toHaveBeenCalledOnce();
    expect(chatStore.getState().activeConnector).toBe("custom");
  });

  it("does not re-register an instance whose name is already registered", async () => {
    const existing = fakeConnector("custom");
    const incoming = fakeConnector("custom");
    const { applyGlobalSettings, chatStore, ConnectorRegistry } = await load({ connector: incoming });
    ConnectorRegistry.register(existing);
    expect(() => applyGlobalSettings()).not.toThrow();
    expect(ConnectorRegistry.get("custom")).toBe(existing);
    expect(chatStore.getState().activeConnector).toBe("custom");
  });

  it("only takes effect on the first call", async () => {
    const { applyGlobalSettings, chatStore } = await load({ connector: "first" });
    applyGlobalSettings();
    window.chativaSettings = { connector: "second" };
    applyGlobalSettings();
    expect(chatStore.getState().activeConnector).toBe("first");
  });

  it("deep-merges theme overrides and syncs allowFullscreen to the store", async () => {
    const { applyGlobalSettings, chatStore } = await load({
      theme: { allowFullscreen: false, colors: { primary: "#123456" } },
    });
    const defaultSecondary = chatStore.getState().theme.colors.secondary;
    applyGlobalSettings();
    const s = chatStore.getState();
    expect(s.theme.colors.primary).toBe("#123456");
    expect(s.theme.colors.secondary).toBe(defaultSecondary);
    expect(s.allowFullscreen).toBe(false);
  });

  it("leaves allowFullscreen untouched when the theme does not set it", async () => {
    const { applyGlobalSettings, chatStore } = await load({ theme: { colors: { primary: "#abcdef" } } });
    applyGlobalSettings();
    expect(chatStore.getState().theme.colors.primary).toBe("#abcdef");
    expect(chatStore.getState().allowFullscreen).toBe(true);
  });

  it("switches the locale immediately when i18next is initialized", async () => {
    const { applyGlobalSettings } = await load({ locale: "tr" });
    applyGlobalSettings();
    await vi.waitFor(() => expect(i18next.language).toBe("tr"));
  });

  it("defers the locale switch until i18next fires 'initialized'", async () => {
    const { applyGlobalSettings } = await load({ locale: "tr" });
    const spy = vi.spyOn(i18next, "isInitialized", "get").mockReturnValue(false);
    try {
      applyGlobalSettings();
      expect(i18next.language).toBe("en");
    } finally {
      spy.mockRestore();
    }
    i18next.emit("initialized", i18next.options);
    await vi.waitFor(() => expect(i18next.language).toBe("tr"));
  });

  it("applies per-language i18n overrides ('all' + locale-specific)", async () => {
    const { applyGlobalSettings } = await load({
      i18n: {
        all: { header: { subtitle: "Everywhere" } },
        tr: { header: { title: "Selam" } },
        de: { header: { title: "Hallo" } },
      },
    });
    applyGlobalSettings();
    expect(i18next.t("header.subtitle", { lng: "en" })).toBe("Everywhere");
    expect(i18next.t("header.subtitle", { lng: "tr" })).toBe("Everywhere");
    expect(i18next.t("header.title", { lng: "tr" })).toBe("Selam");
    // A language only present in the overrides is created too.
    expect(i18next.t("header.title", { lng: "de" })).toBe("Hallo");
    expect(i18next.t("header.subtitle", { lng: "de" })).toBe("Everywhere");
  });

  it("re-applies per-language overrides when the language changes", async () => {
    const { applyGlobalSettings } = await load({
      i18n: { all: { header: { subtitle: "Again" } }, fr: { header: { title: "Salut" } } },
    });
    applyGlobalSettings();
    // Simulate another party overwriting the bundle, then a language switch.
    i18next.addResourceBundle("fr", "translation", { header: { title: "Overwritten" } }, true, true);
    await i18next.changeLanguage("fr");
    expect(i18next.t("header.title", { lng: "fr" })).toBe("Salut");
    expect(i18next.t("header.subtitle", { lng: "fr" })).toBe("Again");
  });

  it("applies a flat i18n object to every registered language", async () => {
    const { applyGlobalSettings } = await load({ i18n: { input: { placeholder: "Type here" } } });
    applyGlobalSettings();
    expect(i18next.t("input.placeholder", { lng: "en" })).toBe("Type here");
    expect(i18next.t("input.placeholder", { lng: "tr" })).toBe("Type here");
  });

  it("re-applies flat overrides on language change", async () => {
    const { applyGlobalSettings } = await load({ i18n: { input: { send: "Go" } } });
    applyGlobalSettings();
    i18next.addResourceBundle("tr", "translation", { input: { send: "Gonder" } }, true, true);
    await i18next.changeLanguage("tr");
    expect(i18next.t("input.send", { lng: "tr" })).toBe("Go");
  });

  it("treats an object with non-locale keys or non-object values as flat", async () => {
    const { applyGlobalSettings } = await load({ i18n: { en: "not-an-object", header: { title: "Flat" } } });
    applyGlobalSettings();
    expect(i18next.t("header.title", { lng: "en" })).toBe("Flat");
  });

  it("defers i18n overrides until i18next is initialized", async () => {
    const { applyGlobalSettings } = await load({ i18n: { footer: { note: "Later" } } });
    const spy = vi.spyOn(i18next, "isInitialized", "get").mockReturnValue(false);
    try {
      applyGlobalSettings();
      expect(i18next.exists("footer.note", { lng: "en" })).toBe(false);
    } finally {
      spy.mockRestore();
    }
    i18next.emit("initialized", i18next.options);
    expect(i18next.t("footer.note", { lng: "en" })).toBe("Later");
  });
});
