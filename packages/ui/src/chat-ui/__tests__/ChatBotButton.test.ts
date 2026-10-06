import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chatStore } from "@chativa/core";
import "../../i18n/i18n";
import "../ChatBotButton";
import { $, mount, resetGlobals } from "../../__tests__/testUtils";

const launcher = (el: HTMLElement) => $<HTMLButtonElement>(el, ".launcher")!;

describe("ChatBotButton", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => resetGlobals());

  it("toggles the widget open state on click and updates its aria state", async () => {
    const el = await mount("chat-bot-button");
    expect(launcher(el).getAttribute("aria-label")).toBe("Open chat");
    expect(launcher(el).getAttribute("aria-expanded")).toBe("false");

    launcher(el).click();
    await el.updateComplete;
    expect(chatStore.getState().isOpened).toBe(true);
    expect(launcher(el).classList.contains("is-open")).toBe(true);
    expect(launcher(el).getAttribute("aria-label")).toBe("Close chat");
    expect(launcher(el).getAttribute("aria-expanded")).toBe("true");

    launcher(el).click();
    await el.updateComplete;
    expect(chatStore.getState().isOpened).toBe(false);
  });

  it("shows an unread badge only while closed, capped at 9+", async () => {
    const el = await mount("chat-bot-button");
    expect($(el, ".badge")).toBeNull();

    chatStore.getState().incrementUnread();
    chatStore.getState().incrementUnread();
    await el.updateComplete;
    expect($(el, ".badge")!.getAttribute("aria-label")).toBe("2 unread messages");
    expect($(el, ".badge")!.textContent!.trim()).toBe("2");

    chatStore.setState({ unreadCount: 12 });
    await el.updateComplete;
    expect($(el, ".badge")!.textContent!.trim()).toBe("9+");

    chatStore.getState().open();
    await el.updateComplete;
    expect($(el, ".badge")).toBeNull();
  });

  it("detects slotted custom content and supports hideButtonOnOpen", async () => {
    chatStore.getState().setTheme({ hideButtonOnOpen: true });
    const el = document.createElement("chat-bot-button") as HTMLElement & { updateComplete: Promise<unknown> };
    const img = document.createElement("img");
    el.appendChild(img);
    document.body.appendChild(el);
    await el.updateComplete;
    $<HTMLSlotElement>(el, "slot")!.dispatchEvent(new Event("slotchange"));
    await el.updateComplete;

    expect(launcher(el).classList.contains("has-slot")).toBe(true);
    expect(launcher(el).classList.contains("hide-on-open")).toBe(true);
  });

  it("renders a custom launcher icon from theme.icons", async () => {
    chatStore.getState().setTheme({ icons: { chatLauncher: '<circle class="custom-icon" r="4"/>' } });
    const el = await mount("chat-bot-button");
    expect($(el, ".icon-chat .custom-icon")).not.toBeNull();
  });

  it("tracks the active language and re-renders its labels (ChatbotMixin)", async () => {
    const { i18next } = await import("@chativa/core");
    const el = (await mount("chat-bot-button")) as HTMLElement & { lang: string; updateComplete: Promise<unknown> };
    expect(el.lang).toBe(i18next.language);
    await i18next.changeLanguage("tr");
    await el.updateComplete;
    try {
      expect(el.lang).toBe("tr");
      expect(launcher(el).getAttribute("aria-label")).toBe(i18next.t("chatButton.open"));
    } finally {
      await i18next.changeLanguage("en");
    }
  });

  it("pushes theme colors onto the host as CSS custom properties", async () => {
    chatStore.getState().setTheme({
      colors: {
        primary: "#111111",
        accent: "#222222",
        surface: "#333333",
        textSecondary: "#444444",
        textTertiary: "#555555",
        success: "#0a0",
        error: "#a00",
        warning: "#aa0",
        info: "#00a",
      },
    });
    const el = await mount("chat-bot-button");
    expect(el.style.getPropertyValue("--chativa-primary-color")).toBe("#111111");
    expect(el.style.getPropertyValue("--chativa-accent-color")).toBe("#222222");
    expect(el.style.getPropertyValue("--chativa-text-muted")).toBe("#555555");
    expect(el.style.getPropertyValue("--chativa-info-color")).toBe("#00a");

    chatStore.getState().setTheme({ colors: { primary: "#999999" } });
    await el.updateComplete;
    expect(el.style.getPropertyValue("--chativa-primary-color")).toBe("#999999");
  });
});
