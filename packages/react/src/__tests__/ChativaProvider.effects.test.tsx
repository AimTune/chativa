import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ExtensionRegistry, chatStore, i18next, type IExtension } from "@chativa/core";
import { ChativaProvider } from "../ChativaProvider";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ChativaProvider extensions", () => {
  it("skips an extension that is already installed", () => {
    const install = vi.fn();
    const extension: IExtension = { name: "provider-preinstalled", version: "1.0.0", install };
    ExtensionRegistry.install(extension);
    install.mockClear();

    render(
      <ChativaProvider extensions={[extension]}>
        <div />
      </ChativaProvider>,
    );

    expect(install).not.toHaveBeenCalled();
    ExtensionRegistry.uninstall("provider-preinstalled");
  });

  it("registers the connector and extensions only on the first render", () => {
    const install = vi.fn();
    const extension: IExtension = { name: "provider-once", version: "1.0.0", install };
    const setConnector = vi.spyOn(chatStore.getState(), "setConnector");

    const { rerender } = render(
      <ChativaProvider connector="provider-once-connector" extensions={[extension]}>
        <div />
      </ChativaProvider>,
    );
    ExtensionRegistry.uninstall("provider-once");
    rerender(
      <ChativaProvider connector="another-connector" extensions={[extension]}>
        <div />
      </ChativaProvider>,
    );

    expect(install).toHaveBeenCalledOnce();
    expect(setConnector).toHaveBeenCalledTimes(1);
    expect(setConnector).toHaveBeenCalledWith("provider-once-connector");
  });
});

describe("ChativaProvider theme", () => {
  it("re-applies the theme when the prop changes", () => {
    const { rerender } = render(
      <ChativaProvider theme={{ colors: { primary: "#111111" } }}>
        <div />
      </ChativaProvider>,
    );
    expect(chatStore.getState().theme.colors.primary).toBe("#111111");

    rerender(
      <ChativaProvider theme={{ colors: { primary: "#222222" } }}>
        <div />
      </ChativaProvider>,
    );
    expect(chatStore.getState().theme.colors.primary).toBe("#222222");
  });
});

/**
 * i18next is initialised by @chativa/ui, which this file never loads, so the
 * first block exercises the "not yet initialised" paths and then initialises
 * i18next itself for the second block. Order matters.
 */
describe("ChativaProvider locale + i18n (before i18next is initialised)", () => {
  it("defers locale and i18n overrides until i18next initialises", async () => {
    expect(i18next.isInitialized).toBeFalsy();

    render(
      <ChativaProvider locale="tr" i18n={{ "header.title": "Destek" }}>
        <div />
      </ChativaProvider>,
    );

    await i18next.init({
      lng: "en",
      resources: { en: { translation: {} }, tr: { translation: {} } },
    });

    await vi.waitFor(() => expect(i18next.language).toBe("tr"));
    expect(i18next.t("header.title", { lng: "en" })).toBe("Destek");
    expect(i18next.t("header.title", { lng: "tr" })).toBe("Destek");
  });

  it("removes its pending 'initialized' listeners on unmount", () => {
    const off = vi.spyOn(i18next, "off");
    vi.spyOn(i18next, "isInitialized", "get").mockReturnValue(false);

    const { unmount } = render(
      <ChativaProvider locale="tr" i18n={{ x: "y" }}>
        <div />
      </ChativaProvider>,
    );
    unmount();

    const offEvents = off.mock.calls.map((c) => c[0]);
    expect(offEvents.filter((e) => e === "initialized")).toHaveLength(2);
    expect(offEvents).toContain("languageChanged");
  });
});

describe("ChativaProvider locale + i18n (after i18next is initialised)", () => {
  afterEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("switches the language immediately", async () => {
    render(
      <ChativaProvider locale="tr">
        <div />
      </ChativaProvider>,
    );
    await vi.waitFor(() => expect(i18next.language).toBe("tr"));
  });

  it("does nothing without a locale or i18n prop", () => {
    const changeLanguage = vi.spyOn(i18next, "changeLanguage");
    const addBundle = vi.spyOn(i18next, "addResourceBundle");
    render(
      <ChativaProvider>
        <div />
      </ChativaProvider>,
    );
    expect(changeLanguage).not.toHaveBeenCalled();
    expect(addBundle).not.toHaveBeenCalled();
  });

  it("applies i18n overrides to every loaded language and re-applies on language change", async () => {
    render(
      <ChativaProvider i18n={{ "input.placeholder": "Ask away" }}>
        <div />
      </ChativaProvider>,
    );
    expect(i18next.t("input.placeholder", { lng: "en" })).toBe("Ask away");
    expect(i18next.t("input.placeholder", { lng: "tr" })).toBe("Ask away");

    // A language bundle loaded later gets the overrides once it becomes active.
    i18next.addResourceBundle("de", "translation", { "input.placeholder": "Frag" });
    await i18next.changeLanguage("de");
    expect(i18next.t("input.placeholder", { lng: "de" })).toBe("Ask away");
  });

  it("stops re-applying overrides after unmount", async () => {
    const { unmount } = render(
      <ChativaProvider i18n={{ "foo.bar": "override" }}>
        <div />
      </ChativaProvider>,
    );
    unmount();

    i18next.addResourceBundle("fr", "translation", { "foo.bar": "original" });
    await i18next.changeLanguage("fr");
    expect(i18next.t("foo.bar", { lng: "fr" })).toBe("original");
  });
});
