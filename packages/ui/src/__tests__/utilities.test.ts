/**
 * Non-component modules: render(), registerCommand(), renderIcon(), and the
 * i18n bootstrap.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatStore, i18next, t, SlashCommandRegistry } from "@chativa/core";
import "../i18n/i18n";
import { render } from "../render";
import { registerCommand } from "../commands/index";
import { renderIcon } from "../utils/icons";
import { resetGlobals } from "./testUtils";

describe("render()", () => {
  let container: HTMLElement;

  beforeEach(() => {
    resetGlobals();
    delete window.chativaSettings;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    delete window.chativaSettings;
    resetGlobals();
  });

  // Plain elements — the custom elements aren't imported here, so nothing
  // upgrades; render() only has to create and place them.
  it("mounts a launcher button and the widget into the container", () => {
    const { widget, button } = render(container);
    expect(button!.tagName).toBe("CHAT-BOT-BUTTON");
    expect(widget.tagName).toBe("CHAT-IVA");
    expect([...container.children]).toEqual([button, widget]);
  });

  it("button: false mounts the widget only", () => {
    const { button } = render(container, { button: false });
    expect(button).toBeNull();
    expect(container.querySelector("chat-bot-button")).toBeNull();
  });

  it("button: string becomes the launcher's inner HTML", () => {
    const { button } = render(container, { button: '<img alt="bot" src="b.gif">' });
    expect(button!.querySelector("img")!.getAttribute("alt")).toBe("bot");
  });

  it("button: Node is appended as slot content", () => {
    const node = document.createElement("span");
    const { button } = render(container, { button: node });
    expect(button!.firstChild).toBe(node);
  });

  it("merges settings into window.chativaSettings (without the button option)", () => {
    window.chativaSettings = { locale: "tr" };
    render(container, { connector: "fake", button: false });
    expect(window.chativaSettings).toEqual({ locale: "tr", connector: "fake" });
  });

  it("exposes theme colors as CSS variables on the container, skipping unset ones", () => {
    render(container, {
      theme: { colors: { primary: "#123456", textTertiary: "#abcdef" } },
    });
    expect(container.style.getPropertyValue("--chativa-primary-color")).toBe("#123456");
    expect(container.style.getPropertyValue("--chativa-text-tertiary")).toBe("#abcdef");
    expect(container.style.getPropertyValue("--chativa-text-muted")).toBe("#abcdef");
    expect(container.style.getPropertyValue("--chativa-accent-color")).toBe("");
  });
});

describe("registerCommand()", () => {
  beforeEach(() => resetGlobals());
  afterEach(async () => {
    resetGlobals();
    await i18next.changeLanguage("en");
  });

  it("registers the command with lazily translated description and usage", async () => {
    const execute = vi.fn();
    registerCommand({
      name: "greet",
      translations: {
        en: { description: "Say hello", usage: "<name>" },
        tr: { description: "Merhaba de", usage: "<isim>" },
      },
      execute,
    });

    const cmd = SlashCommandRegistry.get("greet")!;
    const desc = cmd.description as () => string;
    const usage = cmd.usage as () => string;
    expect(desc()).toBe("Say hello");
    expect(usage()).toBe("<name>");

    await i18next.changeLanguage("tr");
    expect(desc()).toBe("Merhaba de");
    expect(usage()).toBe("<isim>");

    SlashCommandRegistry.execute("greet", "Ada");
    expect(execute).toHaveBeenCalledWith({ args: "Ada" });
  });

  it("skips locales with no strings and defaults usage to empty", () => {
    const addSpy = vi.spyOn(i18next, "addResources");
    registerCommand({ name: "bare", translations: { en: {}, de: { description: "Nackt" } }, execute: () => {} });
    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith("de", "translation", { "commands.bare.description": "Nackt" });
    expect((SlashCommandRegistry.get("bare")!.usage as () => string)()).toBe("");
    addSpy.mockRestore();
  });
});

describe("renderIcon()", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => resetGlobals());

  it("returns the fallback when the theme does not override the icon", () => {
    const fallback = { kind: "fallback" };
    expect(renderIcon("send", fallback)).toBe(fallback);
  });

  it("returns the theme's custom SVG markup when overridden", () => {
    chatStore.getState().setTheme({ icons: { send: '<path d="M0 0"/>' } });
    const result = renderIcon("send", "fallback") as { values?: unknown[] };
    expect(result).not.toBe("fallback");
    expect(result.values).toEqual(['<path d="M0 0"/>']);
  });
});

describe("i18n bootstrap", () => {
  it("loads the bundled en/tr resources into the shared instance", () => {
    expect(i18next.hasResourceBundle("en", "translation")).toBe(true);
    expect(i18next.hasResourceBundle("tr", "translation")).toBe(true);
    expect(t("input.send", { lng: "en" })).toBe("Send message");
  });

  it("only adds resources (keeping the host language) when i18next is already initialised", async () => {
    await i18next.changeLanguage("tr");
    const add = vi.spyOn(i18next, "addResourceBundle");
    const init = vi.spyOn(i18next, "init");
    // A second evaluation of the module (as a second Chativa bundle would do)
    // — the query string makes Vite load a fresh module instance while
    // @chativa/core (and its already-initialised i18next) stays shared.
    const secondCopy = "../i18n/i18n?second-bundle";
    const mod = await import(/* @vite-ignore */ secondCopy);
    expect(mod.default).toBe(i18next);
    expect(init).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledWith("en", "translation", expect.any(Object), true, false);
    expect(add).toHaveBeenCalledWith("tr", "translation", expect.any(Object), true, false);
    expect(i18next.language).toBe("tr");
    add.mockRestore();
    init.mockRestore();
    await i18next.changeLanguage("en");
  });
});
