import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/svelte";
import { createRawSnippet, flushSync } from "svelte";
import {
  ConnectorRegistry,
  ExtensionRegistry,
  chatStore,
  i18next,
  type IExtension,
} from "@chativa/core";
import ChativaProvider from "../ChativaProvider.svelte";
import ProviderWithWidget from "./fixtures/ProviderWithWidget.svelte";
import { makeFakeConnector, waitForElement } from "./helpers";

const text = (value: string) => createRawSnippet(() => ({ render: () => `<div>${value}</div>` }));

describe("ChativaProvider", () => {
  // Runs first, while `i18next` is still uninitialised — `@chativa/ui` (which
  // initialises it) has not been imported by this file yet.
  it("defers locale / i18n overrides until i18next initialises, then applies them", async () => {
    expect(i18next.isInitialized).toBeFalsy();

    render(ChativaProvider, { locale: "tr", i18n: { botName: "Iva Svelte" }, children: text("x") });
    flushSync();

    await import("@chativa/ui");
    await vi.waitFor(() => expect(i18next.language).toBe("tr"), { timeout: 15000 });
    expect(i18next.t("botName")).toBe("Iva Svelte");

    // The override survives a language switch.
    await i18next.changeLanguage("en");
    expect(i18next.t("botName")).toBe("Iva Svelte");
  });

  it("applies locale / i18n immediately once i18next is initialised, and cleans up on unmount", async () => {
    const { unmount } = render(ChativaProvider, { locale: "en", i18n: { botName: "Now" } });
    flushSync();
    await vi.waitFor(() => expect(i18next.language).toBe("en"));
    expect(i18next.t("botName")).toBe("Now");
    unmount();
  });

  it("renders its children synchronously", () => {
    const { getByText } = render(ChativaProvider, { children: text("hello") });
    expect(getByText("hello")).toBeTruthy();
  });

  it("auto-registers an IConnector instance and activates it in chatStore", () => {
    render(ChativaProvider, { connector: makeFakeConnector("svelte-provider-1") });

    expect(ConnectorRegistry.has("svelte-provider-1")).toBe(true);
    expect(chatStore.getState().activeConnector).toBe("svelte-provider-1");
    ConnectorRegistry.unregister("svelte-provider-1");
  });

  it("does not re-register an already-registered connector", () => {
    const connector = makeFakeConnector("svelte-provider-2");
    ConnectorRegistry.register(connector);

    expect(() => render(ChativaProvider, { connector })).not.toThrow();
    ConnectorRegistry.unregister("svelte-provider-2");
  });

  it("installs extensions once", () => {
    let installCount = 0;
    const extension: IExtension = {
      name: "svelte-provider-extension",
      version: "1.0.0",
      install() {
        installCount++;
      },
    };

    render(ChativaProvider, { extensions: [extension] });
    render(ChativaProvider, { extensions: [extension] });

    expect(installCount).toBe(1);
    expect(ExtensionRegistry.has("svelte-provider-extension")).toBe(true);
    ExtensionRegistry.uninstall("svelte-provider-extension");
  });

  it("applies theme overrides and re-applies them when the prop changes", () => {
    const { rerender } = render(ChativaProvider, { theme: { colors: { primary: "#123456" } } });
    flushSync();
    expect(chatStore.getState().theme.colors.primary).toBe("#123456");

    void rerender({ theme: { colors: { primary: "#654321" } } });
    flushSync();
    expect(chatStore.getState().theme.colors.primary).toBe("#654321");
  });

  it("activates its connector before a nested <ChatIva> connects", async () => {
    render(ProviderWithWidget, { connector: makeFakeConnector("svelte-provider-3") });

    await waitForElement("chat-iva");
    const button = await waitForElement("chat-bot-button");

    expect(chatStore.getState().activeConnector).toBe("svelte-provider-3");
    expect(button.querySelector(".custom-launcher")).not.toBeNull();
  });
});
