import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatStore, messageStore, type StoredMessage, type ToolCall } from "@chativa/core";
import "../ChatMessageList";
import "../DefaultTextMessage";
import "../CardMessage";
import { $, $$, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

const cleanups: (() => void)[] = [];
function listen(type: string) {
  const events: CustomEvent[] = [];
  const fn = (e: Event) => events.push(e as CustomEvent);
  document.addEventListener(type, fn);
  cleanups.push(() => document.removeEventListener(type, fn));
  return events;
}

const add = (msg: StoredMessage) => messageStore.getState().addMessage(msg);
const bot = (id: string, text: string, extra: Partial<StoredMessage> = {}): StoredMessage =>
  ({ id, type: "text", from: "bot", data: { text }, timestamp: 1_700_000_000_000, ...extra });
const user = (id: string, text: string): StoredMessage =>
  ({ id, type: "text", from: "user", data: { text }, timestamp: 1_700_000_000_000 });

/** Run queued requestAnimationFrame callbacks. */
const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

/** Give the jsdom list element real scroll geometry. */
function setGeometry(list: Element, g: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  Object.defineProperty(list, "scrollHeight", { configurable: true, get: () => g.scrollHeight });
  Object.defineProperty(list, "clientHeight", { configurable: true, get: () => g.clientHeight });
  let top = g.scrollTop;
  Object.defineProperty(list, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (v: number) => { top = v; },
  });
}

async function render() {
  return mount<LitLike>("chat-message-list");
}

describe("ChatMessageList — states", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => {
    cleanups.splice(0).forEach((fn) => fn());
    resetGlobals();
  });

  it("shows a connecting spinner while idle/connecting with no messages", async () => {
    const el = await render();
    expect($(el, ".connecting")!.getAttribute("aria-label")).toBe("Connecting…");
  });

  it("shows the empty state once connected without messages", async () => {
    chatStore.getState().setConnectorStatus("connected");
    const el = await render();
    expect($(el, ".empty-title")!.textContent).toBe("How can I help you?");
    expect($(el, ".list")!.getAttribute("role")).toBe("log");
  });

  it("shows an error state whose retry button dispatches chat-retry", async () => {
    const retries = listen("chat-retry");
    chatStore.getState().setConnectorStatus("error");
    const el = await render();
    expect($(el, ".error-title")!.textContent).toBe("Connection lost");
    $<HTMLButtonElement>(el, ".retry-btn")!.click();
    expect(retries).toHaveLength(1);
    expect(retries[0].composed).toBe(true);
  });

  it("shows a reconnecting banner with the attempt number when messages exist", async () => {
    add(bot("m1", "hi"));
    chatStore.setState({ connectorStatus: "connecting", reconnectAttempt: 2 });
    const el = await render();
    expect($(el, ".reconnecting-banner")!.textContent).toContain("Reconnecting… (attempt 2)");
    expect($(el, "default-text-message")).not.toBeNull();
  });
});

describe("ChatMessageList — messages", () => {
  beforeEach(() => {
    resetGlobals();
    chatStore.getState().setConnectorStatus("connected");
  });
  afterEach(() => {
    cleanups.splice(0).forEach((fn) => fn());
    resetGlobals();
  });

  it("renders each message with its registered component and grouping props", async () => {
    const { CardMessage } = await import("../CardMessage");
    add(bot("b1", "one"));
    add(bot("b2", "two"));
    add(user("u1", "mine"));
    add({ id: "c1", type: "card", from: "bot", data: { title: "Card" }, component: CardMessage as unknown as typeof HTMLElement });
    const el = await render();

    const texts = $$<HTMLElement & { messageId: string; hideAvatar: boolean; timestamp: number; sender: string }>(
      el,
      "default-text-message",
    );
    expect(texts.map((t) => t.messageId)).toEqual(["b1", "b2", "u1"]);
    // b1 is followed by another bot message → avatar hidden, no timestamp.
    expect(texts[0].hideAvatar).toBe(true);
    expect(texts[0].timestamp).toBe(0);
    expect(texts[1].hideAvatar).toBe(false);
    expect(texts[1].timestamp).toBe(1_700_000_000_000);
    expect(texts[2].sender).toBe("user");
    expect($(el, "card-message")).not.toBeNull();
  });

  it("resolves the tag by instantiating the component where customElements.getName is missing", async () => {
    const { CardMessage } = await import("../CardMessage");
    class NotACustomElement {
      tagName = "DIV";
    }
    const getName = customElements.getName;
    (customElements as unknown as { getName?: unknown }).getName = undefined;
    try {
      add({ id: "c1", type: "card", from: "bot", data: { title: "Card" }, component: CardMessage as unknown as typeof HTMLElement });
      add({ id: "x1", type: "odd", from: "bot", data: { text: "fallback" }, component: NotACustomElement as unknown as typeof HTMLElement });
      const el = await render();
      expect($(el, "card-message")).not.toBeNull();
      expect($<HTMLElement & { messageId: string }>(el, "default-text-message")!.messageId).toBe("x1");
    } finally {
      customElements.getName = getName;
    }
  });

  it("offsets bot extras under the avatar unless showBot is false", async () => {
    add(bot("b1", "one"));
    const el = await render();
    expect($(el, "message-feedback")!.classList.contains("avatar-offset")).toBe(true);

    chatStore.getState().setTheme({ avatar: { showBot: false } });
    await el.updateComplete;
    expect($(el, "message-feedback")!.classList.contains("avatar-offset")).toBe(false);
  });

  it("attaches a tool-call trace above bot messages that carry toolCalls", async () => {
    const calls: ToolCall[] = [{ id: "t1", name: "search", status: "completed" }];
    add(bot("b1", "with tools", { data: { text: "with tools", toolCalls: calls } }));
    add(bot("b2", "bad tools", { data: { text: "bad", toolCalls: "nope" } }));
    const el = await render();
    const activities = $$<HTMLElement & { toolCalls: ToolCall[] }>(el, ".tool-activity-attached tool-call-activity");
    expect(activities).toHaveLength(1);
    expect(activities[0].toolCalls).toEqual(calls);
  });

  it("shows the live tool-call strip while tools are running", async () => {
    const el = await render();
    expect($(el, ".tool-activity-live")).toBeNull();
    chatStore.getState().upsertToolCall({ id: "t1", name: "lookup", status: "running" });
    await el.updateComplete;
    const live = $<HTMLElement & { live: boolean }>(el, ".tool-activity-live tool-call-activity")!;
    expect(live.live).toBe(true);
  });

  describe("typing indicator", () => {
    it("shows dots while the bot is typing and hides them afterwards", async () => {
      const el = await render();
      expect($(el, ".typing-bubble")).toBeNull();
      chatStore.getState().setTyping(true);
      await el.updateComplete;
      expect($(el, ".typing-bubble")!.getAttribute("aria-label")).toBe("Assistant is typing");
      expect($$(el, ".typing-dot")).toHaveLength(3);
      expect($(el, ".typing-text")).toBeNull();

      chatStore.getState().setTyping(false);
      await el.updateComplete;
      expect($(el, ".typing-bubble")).toBeNull();
    });

    it("shows a backend progress message next to the dots", async () => {
      const el = await render();
      chatStore.getState().setTypingMessage("Searching knowledge base…");
      await el.updateComplete;
      expect($(el, ".typing-text")!.textContent!.trim()).toBe("Searching knowledge base…");

      chatStore.getState().setTypingMessage("Writing answer…");
      await el.updateComplete;
      expect($(el, ".typing-text")!.textContent!.trim()).toBe("Writing answer…");
    });
  });

  describe("history", () => {
    it("shows a load-more button that dispatches chat-load-history", async () => {
      const loads = listen("chat-load-history");
      chatStore.getState().setHasMoreHistory(true);
      add(bot("b1", "hi"));
      const el = await render();
      const btn = $<HTMLButtonElement>(el, ".load-more-btn")!;
      expect(btn.textContent).toContain("Load previous messages");
      btn.click();
      expect(loads).toHaveLength(1);
    });

    it("shows a spinner and disables the button while loading", async () => {
      chatStore.setState({ hasMoreHistory: true, isLoadingHistory: true });
      add(bot("b1", "hi"));
      const el = await render();
      const btn = $<HTMLButtonElement>(el, ".load-more-btn")!;
      expect(btn.disabled).toBe(true);
      expect(btn.querySelector(".mini-spinner")!.getAttribute("aria-label")).toBe("Loading previous messages…");
    });

    it("keeps the visual position after older messages are prepended", async () => {
      chatStore.getState().setHasMoreHistory(true);
      add(bot("b1", "latest"));
      const el = await render();
      const list = $(el, ".list")!;
      const geo = { scrollHeight: 500, clientHeight: 200, scrollTop: 0 };
      setGeometry(list, geo);
      await frame(); // initial pin-to-bottom
      list.scrollTop = 0; // the user scrolled to the top to reach the button

      $<HTMLButtonElement>(el, ".load-more-btn")!.click(); // captures scrollHeight = 500
      chatStore.getState().setIsLoadingHistory(true);
      await el.updateComplete;
      messageStore.getState().prependMessages([bot("old1", "older")]);
      geo.scrollHeight = 800;
      chatStore.getState().setIsLoadingHistory(false);
      await el.updateComplete;
      await frame();

      expect(list.scrollTop).toBe(300);
      expect($$<HTMLElement & { messageId: string }>(el, "default-text-message").map((m) => m.messageId)).toEqual([
        "old1",
        "b1",
      ]);
    });
  });

  describe("search filter", () => {
    it("filters messages by text (case-insensitive) and reports the result count", async () => {
      add(bot("b1", "Your Invoice is ready"));
      add(user("u1", "thanks"));
      add({ id: "c1", type: "card", from: "bot", data: { title: "invoice card" } });
      const el = await render();

      chatStore.getState().setSearchQuery("invoice");
      await el.updateComplete;
      expect($(el, ".search-result-bar")!.textContent!.trim()).toBe("2 result(s) found");
      expect($$<HTMLElement & { messageId: string }>(el, "default-text-message").map((m) => m.messageId)).toEqual([
        "b1",
        "c1",
      ]);
    });

    it("shows an empty-search message (not the empty state) when nothing matches", async () => {
      add(bot("b1", "hello"));
      chatStore.getState().setSearchQuery("zzz");
      const el = await render();
      expect($(el, ".search-result-bar")!.textContent!.trim()).toBe("No messages match your search.");
      expect($(el, ".empty")).toBeNull();
      expect($(el, "default-text-message")).toBeNull();
    });

    it("tolerates message data that cannot be serialised", async () => {
      const circular: Record<string, unknown> = { text: "x" };
      circular.self = circular;
      add({ id: "b1", type: "text", from: "bot", data: circular });
      chatStore.getState().setSearchQuery("nomatch");
      const el = await render();
      expect($(el, "default-text-message")).toBeNull();
    });
  });

  describe("scroll pinning & new-message pill", () => {
    it("pins to the bottom when a message arrives while at the bottom", async () => {
      add(bot("b1", "first"));
      const el = await render();
      const list = $(el, ".list")!;
      setGeometry(list, { scrollHeight: 1000, clientHeight: 200, scrollTop: 800 });

      add(bot("b2", "second"));
      await el.updateComplete;
      await frame();
      expect(list.scrollTop).toBe(1000);
      expect($(el, ".new-msg-pill")).toBeNull();
    });

    it("shows a pill when scrolled up, and scrolls down when clicked", async () => {
      add(bot("b1", "first"));
      const el = await render();
      const list = $(el, ".list")!;
      setGeometry(list, { scrollHeight: 1000, clientHeight: 200, scrollTop: 0 });
      const scrollTo = vi.fn();
      (list as unknown as { scrollTo: unknown }).scrollTo = scrollTo;
      list.dispatchEvent(new Event("scroll"));

      add(bot("b2", "second"));
      await el.updateComplete;
      await el.updateComplete;
      const pill = $<HTMLButtonElement>(el, ".new-msg-pill")!;
      expect(pill.textContent).toContain("New message");

      pill.click();
      await el.updateComplete;
      expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: "smooth" });
      expect($(el, ".new-msg-pill")).toBeNull();
    });

    it("shows the pill for in-place updates while scrolled up and hides it when the user scrolls back down", async () => {
      add(bot("b1", "first"));
      const el = await render();
      const list = $(el, ".list")!;
      const geo = { scrollHeight: 1000, clientHeight: 200, scrollTop: 0 };
      setGeometry(list, geo);
      list.dispatchEvent(new Event("scroll"));

      messageStore.getState().updateById("b1", { data: { text: "first (edited)" } });
      await el.updateComplete;
      await el.updateComplete;
      expect($(el, ".new-msg-pill")).not.toBeNull();

      list.scrollTop = 790;
      list.dispatchEvent(new Event("scroll"));
      await el.updateComplete;
      expect($(el, ".new-msg-pill")).toBeNull();
    });

    it("keeps pinned for in-place updates and typing changes while at the bottom", async () => {
      add(bot("b1", "first"));
      const el = await render();
      const list = $(el, ".list")!;
      setGeometry(list, { scrollHeight: 1000, clientHeight: 200, scrollTop: 800 });

      messageStore.getState().updateById("b1", { data: { text: "streamed more" } });
      await el.updateComplete;
      await frame();
      expect(list.scrollTop).toBe(1000);

      list.scrollTop = 800;
      chatStore.getState().setTyping(true);
      await el.updateComplete;
      await frame();
      expect(list.scrollTop).toBe(1000);
    });

    it("resets the pill after the conversation is cleared", async () => {
      add(bot("b1", "first"));
      const el = await render();
      const list = $(el, ".list")!;
      setGeometry(list, { scrollHeight: 1000, clientHeight: 200, scrollTop: 0 });
      list.dispatchEvent(new Event("scroll"));
      add(bot("b2", "second"));
      await el.updateComplete;
      await el.updateComplete;
      expect($(el, ".new-msg-pill")).not.toBeNull();

      messageStore.getState().clear();
      await el.updateComplete;
      await el.updateComplete;
      expect($(el, ".new-msg-pill")).toBeNull();
    });
  });

  it("stops reacting to store updates once disconnected", async () => {
    const el = await render();
    const spy = vi.spyOn(el as unknown as { requestUpdate(): void }, "requestUpdate");
    el.remove();
    add(bot("b1", "late"));
    chatStore.getState().setTyping(true);
    expect(spy).not.toHaveBeenCalled();
  });
});
