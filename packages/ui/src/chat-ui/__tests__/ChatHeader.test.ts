import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chatStore, type ConnectorStatus } from "@chativa/core";
// ChatHeader reads strings via core `t` but does not load the bundled
// resources itself (the package entry does) — load them for the test.
import "../../i18n/i18n";
import "../ChatHeader";
import { $, $$, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

type Header = LitLike & { showConvToggle: boolean };

function listen(type: string) {
  const events: CustomEvent[] = [];
  const fn = (e: Event) => events.push(e as CustomEvent);
  document.addEventListener(type, fn);
  cleanups.push(() => document.removeEventListener(type, fn));
  return events;
}
const cleanups: (() => void)[] = [];

const byLabel = (el: HTMLElement, label: string) =>
  $$<HTMLButtonElement>(el, "button").find((b) => b.getAttribute("aria-label") === label);

describe("ChatHeader", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => {
    cleanups.splice(0).forEach((fn) => fn());
    resetGlobals();
  });

  it("shows the title and default avatar", async () => {
    const el = await mount<Header>("chat-header");
    expect($(el, ".title")!.textContent).toBe("Chativa Chatbot");
    expect($(el, ".avatar svg")).not.toBeNull();
  });

  it("uses theme.avatar.header as the header image", async () => {
    chatStore.getState().setTheme({ avatar: { header: "https://a.test/h.png" } });
    const el = await mount<Header>("chat-header");
    expect($(el, ".avatar img")!.getAttribute("src")).toBe("https://a.test/h.png");
  });

  it.each([
    ["idle", "Offline"],
    ["connecting", "Connecting…"],
    ["connected", "Online"],
    ["error", "Connection error"],
    ["disconnected", "Disconnected"],
  ] as [ConnectorStatus, string][])("labels the %s status", async (status, label) => {
    chatStore.getState().setConnectorStatus(status);
    const el = await mount<Header>("chat-header");
    expect($(el, ".status-text")!.textContent).toBe(label);
    expect($(el, ".status-dot")!.classList.contains(status)).toBe(true);
  });

  it("minimize and close buttons dispatch their request events", async () => {
    const minimize = listen("chat-minimize-requested");
    const close = listen("chat-close-requested");
    const el = await mount<Header>("chat-header");
    byLabel(el, "Minimize")!.click();
    byLabel(el, "Close")!.click();
    expect(minimize).toHaveLength(1);
    expect(close).toHaveLength(1);
    expect(close[0].composed).toBe(true);
  });

  it("toggles fullscreen and hides the toggle when fullscreen is not allowed", async () => {
    const el = await mount<Header>("chat-header");
    byLabel(el, "Enter fullscreen")!.click();
    await el.updateComplete;
    expect(chatStore.getState().isFullscreen).toBe(true);
    expect(byLabel(el, "Exit fullscreen")).toBeDefined();

    chatStore.getState().setAllowFullscreen(false);
    await el.updateComplete;
    expect(byLabel(el, "Exit fullscreen")).toBeUndefined();
    expect(byLabel(el, "Enter fullscreen")).toBeUndefined();
  });

  it("opens search, writes the query to the store and clears it on close", async () => {
    const el = await mount<Header>("chat-header");
    byLabel(el, "Search")!.click();
    await el.updateComplete;

    const input = $<HTMLInputElement>(el, ".search-input")!;
    expect(input.getAttribute("placeholder")).toBe("Search messages…");
    expect($(el, ".title")).toBeNull(); // title area hidden while searching
    await Promise.resolve();
    expect(el.shadowRoot!.activeElement).toBe(input);

    input.value = "invoice";
    input.dispatchEvent(new Event("input"));
    expect(chatStore.getState().searchQuery).toBe("invoice");

    byLabel(el, "Search")!.click();
    await el.updateComplete;
    expect(chatStore.getState().searchQuery).toBe("");
    expect($(el, ".search-input")).toBeNull();
  });

  it("Escape in the search box closes search; other keys do not", async () => {
    const el = await mount<Header>("chat-header");
    byLabel(el, "Search")!.click();
    await el.updateComplete;
    const input = $<HTMLInputElement>(el, ".search-input")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    await el.updateComplete;
    expect($(el, ".search-input")).not.toBeNull();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await el.updateComplete;
    expect($(el, ".search-input")).toBeNull();
  });

  it("hides search entirely when theme.enableSearch is false", async () => {
    chatStore.getState().setTheme({ enableSearch: false });
    const el = await mount<Header>("chat-header");
    expect(byLabel(el, "Search")).toBeUndefined();
  });

  it("shows the conversations toggle only when enabled and not searching", async () => {
    const shows = listen("show-conversations");
    const el = await mount<Header>("chat-header", { showConvToggle: true });
    byLabel(el, "Back to conversations")!.click();
    expect(shows).toHaveLength(1);

    byLabel(el, "Search")!.click();
    await el.updateComplete;
    expect(byLabel(el, "Back to conversations")).toBeUndefined();

    const plain = await mount<Header>("chat-header");
    expect(byLabel(plain, "Back to conversations")).toBeUndefined();
  });

  describe("drag handle", () => {
    it("mousedown on the header body dispatches chat-drag-start with coordinates", async () => {
      const drags = listen("chat-drag-start");
      const el = await mount<Header>("chat-header");
      $(el, ".title")!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 10, clientY: 20 }));
      expect(drags.map((e) => e.detail)).toEqual([{ clientX: 10, clientY: 20 }]);
    });

    it("mousedown on action buttons does not start a drag", async () => {
      const drags = listen("chat-drag-start");
      const el = await mount<Header>("chat-header");
      byLabel(el, "Close")!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(drags).toHaveLength(0);
    });

    it("touchstart starts a drag from the first touch point, but not from actions", async () => {
      const drags = listen("chat-drag-start");
      const el = await mount<Header>("chat-header");
      const touchEvent = (target: Element) => {
        const ev = new Event("touchstart", { bubbles: true }) as Event & { touches: unknown };
        Object.defineProperty(ev, "touches", { value: [{ clientX: 5, clientY: 6 }] });
        target.dispatchEvent(ev);
      };
      touchEvent($(el, ".title")!);
      touchEvent(byLabel(el, "Close")!);
      expect(drags.map((e) => e.detail)).toEqual([{ clientX: 5, clientY: 6 }]);
    });
  });
});
