import { describe, it, expect, afterEach } from "vitest";
import { i18next as coreI18next, applyGlobalSettings } from "@chativa/core";
import { i18next, t } from "../index";

/**
 * There must be exactly one i18next instance across `@chativa/core` and
 * `@chativa/ui`. When there were two, `applyGlobalSettings` (and
 * `<ChativaProvider>`'s `locale` / `i18n` props) wrote the host's overrides into
 * an instance no component ever read from — the bot name and language settings
 * silently did nothing, and `i18next.store` was undefined besides.
 */
describe("@chativa/ui — i18n instance", () => {
  afterEach(() => {
    delete window.chativaSettings;
  });

  it("exports the instance @chativa/core exports, already initialised", () => {
    expect(i18next).toBe(coreI18next);
    expect(i18next.isInitialized).toBe(true);
    // Resources are loaded, so keys resolve rather than echoing back.
    expect(t("header.title")).toBe("Chativa Chatbot");
  });

  it("applies a chativaSettings i18n override to the strings components read", () => {
    window.chativaSettings = { i18n: { header: { title: "Acme Assistant" } } };
    applyGlobalSettings();

    expect(t("header.title")).toBe("Acme Assistant");
  });
});
