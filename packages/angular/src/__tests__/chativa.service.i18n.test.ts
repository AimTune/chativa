// Locale / translation behavior of ChativaService. This file never imports
// `@chativa/ui`, so the shared i18next instance starts UNINITIALISED here
// (vitest isolates modules per file) — which is exactly the state the
// deferred-apply paths of `setLocale` / `setTranslations` are written for.
// The first test initialises i18next itself; the later tests rely on that,
// so the order of the tests in this file matters.
import "./zone-testbed";
import { describe, it, expect, afterEach, vi } from "vitest";
import { TestBed } from "@angular/core/testing";
import { chatStore, i18next } from "@chativa/core";
import { ChativaService } from "../chativa.service";
import { makeFakeConnector, waitFor } from "./helpers";

afterEach(() => {
  TestBed.resetTestingModule();
  chatStore.getState().setConnector("dummy");
});

describe("ChativaService i18n", () => {
  it("queues locale and translation changes until i18next initialises, keeping only the latest pending locale", async () => {
    const changeLanguage = vi.spyOn(i18next, "changeLanguage");
    expect(i18next.isInitialized).toBeFalsy();

    // A service destroyed while its switch is still pending must not apply it.
    const destroyed = TestBed.inject(ChativaService);
    destroyed.setLocale("pt");
    TestBed.resetTestingModule();

    const service = TestBed.inject(ChativaService);
    service.setLocale("tr");
    service.setLocale("de"); // replaces the pending "tr" switch
    service.setTranslations({ "test.greeting": "Queued override" });
    expect(changeLanguage).not.toHaveBeenCalled();

    await i18next.init({
      lng: "en",
      fallbackLng: false,
      resources: { en: { translation: {} }, tr: { translation: {} }, de: { translation: {} } },
    });

    expect(changeLanguage).toHaveBeenCalledWith("de");
    expect(changeLanguage).not.toHaveBeenCalledWith("tr");
    expect(changeLanguage).not.toHaveBeenCalledWith("pt");
    await waitFor(() => expect(i18next.language).toBe("de"));
    expect(i18next.t("test.greeting")).toBe("Queued override");
    changeLanguage.mockRestore();
  });

  it("setLocale switches the language immediately once i18next is initialised", async () => {
    const service = TestBed.inject(ChativaService);
    expect(i18next.isInitialized).toBe(true);
    service.setLocale("tr");
    await waitFor(() => expect(i18next.language).toBe("tr"));
  });

  it("setTranslations applies overrides to every registered language and follows language switches", async () => {
    const service = TestBed.inject(ChativaService);
    service.setTranslations({ "test.farewell": "Bye now" });
    expect(i18next.t("test.farewell")).toBe("Bye now");

    // "fr" was never registered — the languageChanged listener adds the
    // overrides to the new language on the fly.
    await i18next.changeLanguage("fr");
    expect(i18next.t("test.farewell")).toBe("Bye now");
  });

  it("replaces earlier overrides so only the latest set follows new languages", async () => {
    const service = TestBed.inject(ChativaService);
    service.setTranslations({ "test.first": "First" });
    service.setTranslations({ "test.second": "Second" });

    await i18next.changeLanguage("it");
    expect(i18next.t("test.second")).toBe("Second");
    // The first set's languageChanged listener was removed, so its key never
    // reached the new language (fallbackLng is off → the bare key comes back).
    expect(i18next.t("test.first")).toBe("test.first");
  });

  it("stops re-applying translation overrides after the injector is destroyed", async () => {
    const service = TestBed.inject(ChativaService);
    service.setTranslations({ "test.destroyed": "Should not follow" });
    TestBed.resetTestingModule();

    await i18next.changeLanguage("nl");
    expect(i18next.t("test.destroyed")).toBe("test.destroyed");
  });

  it("configure() applies connector, theme, locale and i18n overrides in one call", async () => {
    const service = TestBed.inject(ChativaService);
    service.configure({
      connector: makeFakeConnector("cfg-connector"),
      theme: { colors: { primary: "#abcdef" } },
      locale: "de",
      i18n: { "test.configured": "Configured" },
    });

    expect(chatStore.getState().activeConnector).toBe("cfg-connector");
    expect(chatStore.getState().theme.colors.primary).toBe("#abcdef");
    expect(i18next.t("test.configured")).toBe("Configured");
    await waitFor(() => expect(i18next.language).toBe("de"));
  });
});
