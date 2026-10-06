/**
 * DOM-level behaviour of buttons / quick-reply messages. The sibling
 * ButtonsMessage / QuickReplyMessage tests mock Lit to unit-test pure render
 * helpers; these mount the real elements and click through them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatStore } from "@chativa/core";
import "../ButtonsMessage";
import "../QuickReplyMessage";
import { $, $$, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

type Msg = LitLike & {
  messageData: Record<string, unknown>;
  sender: "bot" | "user";
  timestamp: number;
  hideAvatar: boolean;
};

let actions: unknown[];
const onAction = (e: Event) => actions.push((e as CustomEvent).detail);
let openSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetGlobals();
  actions = [];
  document.addEventListener("chat-action", onAction);
  openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
});

afterEach(() => {
  document.removeEventListener("chat-action", onAction);
  openSpy.mockRestore();
  resetGlobals();
});

describe("ButtonsMessage (DOM)", () => {
  const buttons = [{ label: "**Yes**", value: "yes" }, { label: "No" }, { label: "Site", url: "https://s.test" }];

  it("renders the body as markdown with links opening in a new tab", async () => {
    const el = await mount<Msg>("buttons-message", {
      messageData: { text: "Read [docs](https://d.test)", buttons },
    });
    const link = $<HTMLAnchorElement>(el, ".bubble a")!;
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect($(el, ".action-btn strong")!.textContent).toBe("Yes");
  });

  it("one-time mode: first click dispatches a markdown chat-action and collapses to a confirmation", async () => {
    const el = await mount<Msg>("buttons-message", { messageData: { buttons } });
    $$(el, ".action-btn")[0].click();
    await el.updateComplete;

    expect(actions).toEqual([{ text: "yes", markdown: true }]);
    expect($(el, ".btn-list")).toBeNull();
    expect($(el, ".selected-value strong")!.textContent).toBe("Yes");

    // Further clicks are ignored.
    (el as unknown as { _onButtonClick(a: unknown): void })._onButtonClick({ label: "No" });
    expect(actions).toHaveLength(1);
  });

  it("url buttons open a new tab instead of dispatching", async () => {
    const el = await mount<Msg>("buttons-message", { messageData: { buttons } });
    $$(el, ".action-btn")[2].click();
    expect(openSpy).toHaveBeenCalledWith("https://s.test", "_blank", "noopener");
    expect(actions).toEqual([]);
  });

  it("persistent mode keeps the list, dims the others and toggles selection off", async () => {
    const el = await mount<Msg>("buttons-message", { messageData: { buttons, persistent: true } });
    $$(el, ".action-btn")[1].click();
    await el.updateComplete;

    const btns = $$<HTMLButtonElement>(el, ".action-btn");
    expect(actions).toEqual([{ text: "No", markdown: true }]);
    expect(btns[1].classList.contains("selected")).toBe(true);
    expect(btns[0].disabled).toBe(true);
    expect(btns[0].classList.contains("unselected")).toBe(true);

    btns[1].click();
    await el.updateComplete;
    expect($$<HTMLButtonElement>(el, ".action-btn").every((b) => !b.disabled)).toBe(true);
    expect(actions).toHaveLength(1);
  });

  it("respects theme avatar settings", async () => {
    chatStore.getState().setTheme({ avatar: { bot: "https://a.test/bot.png" } });
    const el = await mount<Msg>("buttons-message", { messageData: { buttons } });
    expect($(el, ".avatar img")!.getAttribute("src")).toBe("https://a.test/bot.png");

    chatStore.getState().setTheme({ avatar: { showBot: false } });
    const hidden = await mount<Msg>("buttons-message", { messageData: { buttons } });
    expect($(hidden, ".avatar")).toBeNull();
  });
});

describe("QuickReplyMessage (DOM)", () => {
  const replyActions = [{ label: "Yes", value: "/yes" }, { label: "No" }, { label: "Web", url: "https://w.test" }];

  it("renders text and one chip per action", async () => {
    const el = await mount<Msg>("quick-reply-message", { messageData: { text: "Continue?", actions: replyActions } });
    expect($(el, ".bubble")!.textContent).toBe("Continue?");
    expect($$(el, ".chip").map((c) => c.textContent)).toEqual(["Yes", "No", "Web"]);
  });

  it("chips are single use and vanish after the first tap by default", async () => {
    const el = await mount<Msg>("quick-reply-message", { messageData: { actions: replyActions } });
    $$(el, ".chip")[0].click();
    await el.updateComplete;
    expect(actions).toEqual(["/yes"]);
    expect($(el, ".chips")).toBeNull();
  });

  it("keepActions leaves the chips visible with the tapped one selected and all disabled", async () => {
    const el = await mount<Msg>("quick-reply-message", { messageData: { actions: replyActions, keepActions: true } });
    $$(el, ".chip")[1].click();
    await el.updateComplete;

    const chips = $$<HTMLButtonElement>(el, ".chip");
    expect(actions).toEqual(["No"]);
    expect(chips[1].getAttribute("aria-pressed")).toBe("true");
    expect(chips[0].classList.contains("dimmed")).toBe(true);
    expect(chips.every((c) => c.disabled)).toBe(true);
  });

  it("url chips open a link and stay usable", async () => {
    const el = await mount<Msg>("quick-reply-message", { messageData: { actions: replyActions } });
    $$(el, ".chip")[2].click();
    await el.updateComplete;
    expect(openSpy).toHaveBeenCalledWith("https://w.test", "_blank", "noopener");
    expect(actions).toEqual([]);
    expect($$(el, ".chip")).toHaveLength(3);
  });

  it("shows the time only on the last message of a group", async () => {
    const ts = Date.now();
    const last = await mount<Msg>("quick-reply-message", { messageData: { text: "a" }, timestamp: ts });
    expect($(last, ".time")).not.toBeNull();
    const grouped = await mount<Msg>("quick-reply-message", { messageData: { text: "a" }, timestamp: ts, hideAvatar: true });
    expect($(grouped, ".time")).toBeNull();
    expect($(grouped, ".avatar")!.classList.contains("hidden")).toBe(true);
  });

  it("renders a custom bot avatar and none for user messages", async () => {
    chatStore.getState().setTheme({ avatar: { bot: "https://a.test/b.png" } });
    const bot = await mount<Msg>("quick-reply-message", { messageData: { text: "a" } });
    expect($(bot, ".avatar img")).not.toBeNull();
    const user = await mount<Msg>("quick-reply-message", { messageData: { text: "a" }, sender: "user" });
    expect($(user, ".avatar")).toBeNull();
  });
});
