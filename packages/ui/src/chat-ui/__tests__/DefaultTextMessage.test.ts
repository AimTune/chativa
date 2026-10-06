import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatStore, MessageTypeRegistry } from "@chativa/core";
import { DefaultTextMessage } from "../DefaultTextMessage";
import { $, $$, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

type TextMsg = LitLike & {
  messageData: Record<string, unknown>;
  sender: "bot" | "user";
  timestamp: number;
  hideAvatar: boolean;
  status: "sending" | "sent" | "read";
  metadataFetcher: ((url: string) => Promise<unknown>) | null;
};

const render = (props: Partial<TextMsg>) => mount<TextMsg>("default-text-message", props);

describe("DefaultTextMessage", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => {
    resetGlobals();
    delete (window as unknown as Record<string, unknown>).chativaMetadataFetcher;
  });

  it("registers itself as the `text` message type", () => {
    expect(MessageTypeRegistry.resolve("text")).toBe(DefaultTextMessage);
  });

  it("renders bot text as markdown with a bot avatar and an accessible label", async () => {
    const el = await render({ messageData: { text: "Hello **world**" } });
    const message = $(el, ".message")!;
    expect(message.classList.contains("bot")).toBe(true);
    expect(message.getAttribute("aria-label")).toBe("Assistant: Hello **world**");
    expect($(el, ".bubble strong")?.textContent).toBe("world");
    expect($(el, ".avatar svg")).not.toBeNull();
  });

  it("renders user text verbatim (no markdown) unless flagged with _markdown", async () => {
    const plain = await render({ sender: "user", messageData: { text: "**raw**" } });
    expect($(plain, ".message")!.classList.contains("user")).toBe(true);
    expect($(plain, ".bubble strong")).toBeNull();
    expect($(plain, ".bubble")!.textContent).toContain("**raw**");
    expect($(plain, ".user-avatar")).not.toBeNull();

    const md = await render({ sender: "user", messageData: { text: "**bold**", _markdown: true } });
    expect($(md, ".bubble strong")?.textContent).toBe("bold");
  });

  it("does not interpret HTML in user text", async () => {
    const el = await render({ sender: "user", messageData: { text: "<img src=x onerror=alert(1)>" } });
    expect($(el, ".bubble img")).toBeNull();
    expect($(el, ".bubble")!.textContent).toContain("<img");
  });

  it("appends an inline caret while a bot message is streaming", async () => {
    const el = await render({ messageData: { text: "Typing", streaming: true } });
    const caret = $(el, ".bubble .stream-caret");
    expect(caret).not.toBeNull();
    // The caret sits inside the paragraph, right after the text.
    expect(caret!.parentElement!.tagName).toBe("P");
    expect($(el, ".bubble")!.textContent).not.toContain("");

    el.messageData = { text: "Typing done", streaming: false };
    await el.updateComplete;
    expect($(el, ".stream-caret")).toBeNull();
  });

  it("never shows the streaming caret on user messages", async () => {
    const el = await render({ sender: "user", messageData: { text: "hi", streaming: true } });
    expect($(el, ".stream-caret")).toBeNull();
  });

  it("uses custom avatar images from the theme and honours showBot/showUser", async () => {
    chatStore.getState().setTheme({ avatar: { bot: "https://x/bot.png", user: "https://x/u.png" } });
    const bot = await render({ messageData: { text: "a" } });
    expect($<HTMLImageElement>(bot, ".avatar img")!.getAttribute("src")).toBe("https://x/bot.png");
    const user = await render({ sender: "user", messageData: { text: "b" } });
    expect($<HTMLImageElement>(user, ".user-avatar img")!.getAttribute("src")).toBe("https://x/u.png");

    chatStore.getState().setTheme({ avatar: { showBot: false, showUser: false } });
    const noBot = await render({ messageData: { text: "a" } });
    const noUser = await render({ sender: "user", messageData: { text: "b" } });
    expect($(noBot, ".avatar")).toBeNull();
    expect($(noUser, ".avatar")).toBeNull();
  });

  it("keeps the avatar slot but marks it hidden when hideAvatar is set", async () => {
    const el = await render({ messageData: { text: "a" }, hideAvatar: true });
    expect($(el, ".avatar")!.classList.contains("hidden")).toBe(true);
  });

  it("renders a time stamp only when a timestamp is given", async () => {
    const none = await render({ messageData: { text: "a" } });
    expect($(none, ".time")).toBeNull();
    expect($(none, ".meta")).toBeNull();

    const ts = new Date(2024, 0, 1, 9, 5).getTime();
    const el = await render({ messageData: { text: "a" }, timestamp: ts });
    const expected = new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    expect($(el, ".time")!.textContent).toBe(expected);
  });

  describe("status ticks", () => {
    it.each([
      ["sending", "Sending"],
      ["sent", "Sent"],
      ["read", "Read"],
    ] as const)("shows the %s indicator on user messages", async (status, label) => {
      const el = await render({ sender: "user", status, messageData: { text: "a" } });
      expect($(el, ".status-icon")!.getAttribute("aria-label")).toBe(label);
      expect($(el, ".status-icon")!.classList.contains("sending")).toBe(status === "sending");
    });

    it("never shows status on bot messages", async () => {
      const el = await render({ status: "read", messageData: { text: "a" } });
      expect($(el, ".status-icon")).toBeNull();
    });

    it("hides status when theme.showMessageStatus is not true", async () => {
      chatStore.getState().setTheme({ showMessageStatus: false });
      const el = await render({ sender: "user", status: "read", messageData: { text: "a" } });
      expect($(el, ".status-icon")).toBeNull();
    });
  });

  describe("link previews", () => {
    it("renders nothing without urls", async () => {
      const el = await render({ messageData: { text: "a", urls: [] } });
      expect($(el, ".link-previews")).toBeNull();
    });

    it("renders one link-preview-card per url with the variant and the fetcher", async () => {
      const fetcher = vi.fn().mockResolvedValue({ title: "T" });
      const el = await render({
        messageData: { text: "see", urls: ["https://a.test/1", "https://b.test/2"], previewVariant: "expanded" },
        metadataFetcher: fetcher,
      });
      const cards = $$<HTMLElement & { url: string; metadataFetcher: unknown; variant: string }>(
        el,
        "link-preview-card",
      );
      expect(cards.map((c) => c.url)).toEqual(["https://a.test/1", "https://b.test/2"]);
      expect(cards.every((c) => c.getAttribute("variant") === "expanded")).toBe(true);
      expect(cards[0].metadataFetcher).toBe(fetcher);
    });

    it("falls back to window.chativaMetadataFetcher and the compact variant", async () => {
      const globalFetcher = vi.fn().mockResolvedValue({});
      (window as unknown as Record<string, unknown>).chativaMetadataFetcher = globalFetcher;
      const el = await render({ messageData: { text: "x", urls: ["https://c.test/"] } });
      const card = $<HTMLElement & { metadataFetcher: unknown }>(el, "link-preview-card")!;
      expect(card.getAttribute("variant")).toBe("compact");
      expect(card.metadataFetcher).toBe(globalFetcher);
    });
  });

  it("re-renders on language change", async () => {
    const { i18next } = await import("@chativa/core");
    const el = await render({ messageData: { text: "a" } });
    const spy = vi.spyOn(el as unknown as { requestUpdate(): void }, "requestUpdate");
    i18next.emit("languageChanged", "en");
    expect(spy).toHaveBeenCalled();
    el.remove();
    spy.mockClear();
    i18next.emit("languageChanged", "en");
    expect(spy).not.toHaveBeenCalled();
  });
});
