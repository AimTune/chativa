import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chatStore,
  messageStore,
  conversationStore,
  ChatEngine,
  SlashCommandRegistry,
  type Conversation,
} from "@chativa/core";
// The package entry: registers every element plus the survey message type,
// exactly like a host page loading @chativa/ui.
import "../../index";
import {
  $,
  $$,
  flush,
  registerFakeConnector,
  resetGlobals,
  type FakeConnector,
  type LitLike,
} from "../../__tests__/testUtils";

type Widget = LitLike & { connector: string; fullscreenOnly: boolean; fulllscreenOnly: boolean };

const cleanups: (() => void)[] = [];
function listen(target: EventTarget, type: string) {
  const events: CustomEvent[] = [];
  const fn = (e: Event) => events.push(e as CustomEvent);
  target.addEventListener(type, fn);
  cleanups.push(() => target.removeEventListener(type, fn));
  return events;
}

let connector: FakeConnector;

async function mountWidget(attrs: Record<string, string> = {}): Promise<Widget> {
  const el = document.createElement("chat-iva") as Widget;
  el.setAttribute("connector", "fake");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

/** Open the widget and wait for the lazy engine init + connector.connect(). */
async function openWidget(el: Widget) {
  chatStore.getState().open();
  await el.updateComplete;
  await flush();
  await el.updateComplete;
}

/** Dispatch an event from inside the widget's shadow tree, as child components do. */
function fire(el: Widget, type: string, detail?: unknown) {
  const source = $(el, ".widget") ?? el;
  source.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}

const dialog = (el: Widget) => $(el, ".widget");

describe("ChatWidget (<chat-iva>)", () => {
  beforeEach(() => {
    resetGlobals();
    connector = registerFakeConnector("fake");
  });

  afterEach(async () => {
    cleanups.splice(0).forEach((fn) => fn());
    vi.restoreAllMocks();
    resetGlobals();
    await flush();
  });

  describe("open / close", () => {
    it("renders nothing while closed and does not connect until first opened", async () => {
      const el = await mountWidget();
      expect(dialog(el)).toBeNull();
      expect(connector.connect).not.toHaveBeenCalled();

      await openWidget(el);
      const w = dialog(el)!;
      expect(w.getAttribute("role")).toBe("dialog");
      expect(w.getAttribute("aria-modal")).toBe("true");
      expect(w.getAttribute("aria-label")).toBe("Chat");
      expect($(el, "chat-header")).not.toBeNull();
      expect($(el, "chat-message-list")).not.toBeNull();
      expect($(el, "chat-input")).not.toBeNull();
      expect(connector.connect).toHaveBeenCalledTimes(1);
      expect(chatStore.getState().connectorStatus).toBe("connected");
      expect(connector.loadHistory).toHaveBeenCalled();
    });

    it("connects only once across close / reopen cycles", async () => {
      const el = await mountWidget();
      await openWidget(el);
      chatStore.getState().close();
      await el.updateComplete;
      expect(dialog(el)).toBeNull();
      await openWidget(el);
      expect(connector.connect).toHaveBeenCalledTimes(1);
    });

    it("logs (and survives) a failing connect", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      connector.connect.mockRejectedValueOnce(new Error("down"));
      const el = await mountWidget();
      await openWidget(el);
      expect(chatStore.getState().connectorStatus).toBe("error");
      expect(err).toHaveBeenCalledWith("[ChatWidget] Engine init failed:", expect.any(Error));
    });

    it("prefers the connector chosen via the store over the attribute", async () => {
      const other = registerFakeConnector("other");
      chatStore.getState().setConnector("other");
      const el = await mountWidget();
      await openWidget(el);
      expect(other.connect).toHaveBeenCalled();
      expect(connector.connect).not.toHaveBeenCalled();
    });

    it("focuses the text input on open and restores focus on close", async () => {
      const outside = document.createElement("button");
      document.body.appendChild(outside);
      outside.focus();
      chatStore.getState().setConnectorStatus("connected");

      const el = await mountWidget();
      await openWidget(el);
      const input = $(el, "chat-input")!;
      expect(input.shadowRoot!.activeElement?.classList.contains("text-input")).toBe(true);

      chatStore.getState().close();
      await el.updateComplete;
      expect(document.activeElement).toBe(outside);
    });

    it("minimize closes immediately, bypassing the survey", async () => {
      const el = await mountWidget();
      await openWidget(el);
      fire(el, "chat-minimize-requested");
      expect(chatStore.getState().isOpened).toBe(false);
      expect(connector.sendSurvey).not.toHaveBeenCalled();
    });

    it("tears the engine down on disconnect and reconnects after being re-attached", async () => {
      const el = await mountWidget();
      await openWidget(el);
      el.remove();
      await flush();
      expect(connector.disconnect).toHaveBeenCalled();

      document.body.appendChild(el);
      await el.updateComplete;
      chatStore.getState().close();
      await el.updateComplete;
      await openWidget(el);
      expect(connector.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe("window modes", () => {
    it.each([
      [{ windowMode: "fullscreen" }, ["fullscreen"]],
      [{ windowMode: "inline" }, ["inline-mode"]],
      [{ windowMode: "side-panel" }, ["side-panel"]],
      [{ windowMode: "side-panel", position: "bottom-left" }, ["side-panel", "from-left"]],
      [{ windowMode: "popup" }, []],
    ] as const)("theme %o adds classes %o", async (theme, classes) => {
      chatStore.getState().setTheme(theme);
      const el = await mountWidget();
      await openWidget(el);
      const cls = [...dialog(el)!.classList].filter((c) => c !== "widget");
      expect(cls.sort()).toEqual([...classes].sort());
    });

    it("positions a popup next to the launcher, and full-bleed modes without inline position", async () => {
      const el = await mountWidget();
      await openWidget(el);
      expect(dialog(el)!.getAttribute("style")).not.toBe("");

      chatStore.getState().setFullscreen(true);
      await el.updateComplete;
      expect(dialog(el)!.classList.contains("fullscreen")).toBe(true);
      expect(dialog(el)!.getAttribute("style")).toBe("");
    });

    it("fullscreen-only attribute forces fullscreen and hides the toggle", async () => {
      const el = await mountWidget({ "fullscreen-only": "" });
      expect(chatStore.getState().isFullscreen).toBe(true);
      expect(chatStore.getState().allowFullscreen).toBe(false);
      expect(el.fullscreenOnly).toBe(true);
      expect(el.fulllscreenOnly).toBe(true); // deprecated alias
    });

    it("fullscreenOnly=false leaves a host's own allowFullscreen choice alone", async () => {
      chatStore.getState().setAllowFullscreen(false);
      const el = await mountWidget();
      el.fullscreenOnly = false;
      expect(chatStore.getState().allowFullscreen).toBe(false);
      expect(chatStore.getState().isFullscreen).toBe(false);
      el.fulllscreenOnly = true;
      expect(chatStore.getState().isFullscreen).toBe(true);
    });

    it("renders the persistent AI disclaimer when configured", async () => {
      chatStore.getState().setTheme({ disclaimer: { enabled: true, bottomText: "AI can be wrong." } });
      const el = await mountWidget();
      await openWidget(el);
      expect($(el, ".ai-disclaimer")!.textContent!.trim()).toBe("AI can be wrong.");
    });
  });

  describe("drag to move (popup)", () => {
    it("moves the dialog with the mouse and stops on mouseup", async () => {
      const el = await mountWidget();
      await openWidget(el);
      const w = dialog(el)!;
      w.getBoundingClientRect = () => ({ left: 100, top: 100 } as DOMRect);

      fire(el, "chat-drag-start", { clientX: 10, clientY: 10 });
      await el.updateComplete;
      await Promise.resolve();
      expect(dialog(el)!.classList.contains("dragging")).toBe(true);

      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 60, clientY: 40 }));
      expect(dialog(el)!.style.left).toBe("150px");
      expect(dialog(el)!.style.top).toBe("130px");

      document.dispatchEvent(new MouseEvent("mouseup"));
      await el.updateComplete;
      expect(dialog(el)!.classList.contains("dragging")).toBe(false);

      // Listeners detached — further moves do nothing.
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 500, clientY: 500 }));
      expect(dialog(el)!.style.left).toBe("150px");
    });

    it("supports touch dragging", async () => {
      const el = await mountWidget();
      await openWidget(el);
      dialog(el)!.getBoundingClientRect = () => ({ left: 50, top: 50 } as DOMRect);
      fire(el, "chat-drag-start", { clientX: 0, clientY: 0 });
      await el.updateComplete;

      const move = new Event("touchmove", { cancelable: true }) as Event & { touches: unknown };
      Object.defineProperty(move, "touches", { value: [{ clientX: 20, clientY: 30 }] });
      document.dispatchEvent(move);
      expect(move.defaultPrevented).toBe(true);
      expect(dialog(el)!.style.left).toBe("70px");
      expect(dialog(el)!.style.top).toBe("80px");
      document.dispatchEvent(new Event("touchend"));
    });

    it("ignores drag requests in fullscreen or non-popup modes", async () => {
      chatStore.getState().setTheme({ windowMode: "side-panel" });
      const el = await mountWidget();
      await openWidget(el);
      const rect = vi.fn(() => ({ left: 0, top: 0 }) as DOMRect);
      dialog(el)!.getBoundingClientRect = rect;
      fire(el, "chat-drag-start", { clientX: 0, clientY: 0 });
      expect(rect).not.toHaveBeenCalled();
    });
  });

  describe("event wiring to the connector", () => {
    let el: Widget;
    beforeEach(async () => {
      el = await mountWidget();
      await openWidget(el);
      connector.sendMessage.mockClear();
    });

    it("send-message from the input sends a text message", async () => {
      const input = $(el, "chat-input")!;
      input.dispatchEvent(new CustomEvent("send-message", { detail: "  hello  ", bubbles: true, composed: true }));
      await flush();
      expect(connector.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "text", data: { text: "hello" } }));
      expect(messageStore.getState().messages.at(-1)).toMatchObject({ from: "user", data: { text: "hello" } });
    });

    it("ignores blank send-message payloads", async () => {
      $(el, "chat-input")!.dispatchEvent(new CustomEvent("send-message", { detail: "   " }));
      await flush();
      expect(connector.sendMessage).not.toHaveBeenCalled();
    });

    it("chat-action strings and {text, markdown} objects are sent as user messages", async () => {
      fire(el, "chat-action", "/buy");
      fire(el, "chat-action", { text: "**Yes**", markdown: true });
      fire(el, "chat-action", "   ");
      fire(el, "chat-action", undefined);
      await flush();
      expect(connector.sendMessage).toHaveBeenCalledTimes(2);
      expect(connector.sendMessage.mock.calls[0][0].data).toEqual({ text: "/buy" });
      expect(connector.sendMessage.mock.calls[1][0].data).toEqual({ text: "**Yes**", _markdown: true });
    });

    it("logs send failures instead of throwing", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      connector.sendMessage.mockRejectedValueOnce(new Error("x")).mockRejectedValueOnce(new Error("y"));
      fire(el, "chat-action", "a");
      $(el, "chat-input")!.dispatchEvent(new CustomEvent("send-message", { detail: "b" }));
      await flush();
      expect(err).toHaveBeenCalledWith("[ChatWidget] Action send failed:", expect.any(Error));
      expect(err).toHaveBeenCalledWith("[ChatWidget] Send failed:", expect.any(Error));
    });

    it("chativa-feedback is forwarded to connector.sendFeedback", async () => {
      fire(el, "chativa-feedback", { messageId: "m-9", feedback: "dislike" });
      await flush();
      expect(connector.sendFeedback).toHaveBeenCalledWith("m-9", "dislike");
    });

    it("feedback clicked on a rendered bot message reaches the connector", async () => {
      messageStore.getState().addMessage({ id: "bot-1", type: "text", from: "bot", data: { text: "Hi" } });
      await el.updateComplete;
      const list = $(el, "chat-message-list")! as LitLike;
      await list.updateComplete;
      const fb = list.shadowRoot!.querySelector("message-feedback") as LitLike;
      await fb.updateComplete;
      (fb.shadowRoot!.querySelector(".feedback-btn") as HTMLButtonElement).click();
      await flush();
      expect(connector.sendFeedback).toHaveBeenCalledWith("bot-1", "like");
    });

    it("chat-retry re-runs the connector connect", async () => {
      fire(el, "chat-retry");
      await flush();
      expect(connector.connect).toHaveBeenCalledTimes(2);
    });

    it("send-file sends every file, with the text as caption", async () => {
      const a = new File(["a"], "a.txt");
      const b = new File(["b"], "b.txt");
      fire(el, "send-file", { files: [a, b], text: "see these" });
      fire(el, "send-file", { files: [a], text: "" });
      await flush();
      expect(connector.sendFile.mock.calls).toEqual([
        [a, { caption: "see these" }],
        [b, { caption: "see these" }],
        [a, undefined],
      ]);
    });

    it("chat-load-history asks the connector for the next page", async () => {
      connector.loadHistory.mockClear();
      chatStore.getState().setHistoryCursor("cursor-2");
      fire(el, "chat-load-history");
      await flush();
      expect(connector.loadHistory).toHaveBeenCalledWith("cursor-2");
    });

    it("genui-send-event is routed through the engine with scope/component", async () => {
      const spy = vi.spyOn(ChatEngine.prototype, "receiveComponentEvent");
      fire(el, "genui-send-event", {
        msgId: "genui-1",
        eventType: "form_submit",
        payload: { a: 1 },
        scope: "component",
        component: "form",
      });
      expect(spy).toHaveBeenCalledWith("genui-1", "form_submit", { a: 1 }, { scope: "component", component: "form" });
    });

    it("registers the built-in /clear command, which empties the transcript", async () => {
      messageStore.getState().addMessage({ id: "x", type: "text", from: "bot", data: { text: "x" } });
      expect(SlashCommandRegistry.execute("clear", "")).toBe(true);
      expect(messageStore.getState().messages).toHaveLength(0);
    });
  });

  describe("multi-conversation", () => {
    const convs: Conversation[] = [
      { id: "c1", title: "One", status: "open" },
      { id: "c2", title: "Two", status: "open" },
    ];

    let el: Widget;
    beforeEach(async () => {
      connector = registerFakeConnector("fake", { conversations: convs });
      chatStore.getState().setTheme({ enableMultiConversation: true });
      el = await mountWidget();
      await openWidget(el);
    });

    it("loads conversations on init and shows the list on request", async () => {
      expect(conversationStore.getState().activeConversationId).toBe("c1");
      const header = $<LitLike & { showConvToggle: boolean }>(el, "chat-header")!;
      expect(header.showConvToggle).toBe(true);

      fire(el, "show-conversations");
      await el.updateComplete;
      expect($(el, "conversation-list")).not.toBeNull();
      expect($(el, "chat-message-list")).toBeNull();
    });

    it("selecting a conversation switches to it and hides the list", async () => {
      fire(el, "show-conversations");
      await el.updateComplete;
      fire(el, "conversation-select", { id: "c2" });
      await el.updateComplete;
      await flush();
      expect(connector.switchConversation).toHaveBeenCalledWith("c2");
      expect(conversationStore.getState().activeConversationId).toBe("c2");
      expect($(el, "conversation-list")).toBeNull();
    });

    it("new-conversation creates one and conversation-close closes one", async () => {
      fire(el, "new-conversation");
      await flush();
      expect(connector.createConversation).toHaveBeenCalled();

      fire(el, "conversation-close", { id: "c2" });
      await flush();
      expect(connector.closeConversation).toHaveBeenCalledWith("c2");
    });

    it("logs multi-conversation failures", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      connector.switchConversation.mockRejectedValueOnce(new Error("a"));
      connector.createConversation.mockRejectedValueOnce(new Error("b"));
      connector.closeConversation.mockRejectedValueOnce(new Error("c"));
      fire(el, "conversation-select", { id: "c2" });
      fire(el, "new-conversation");
      fire(el, "conversation-close", { id: "c1" });
      await flush();
      expect(err).toHaveBeenCalledWith("[ChatWidget] switchTo failed:", expect.any(Error));
      expect(err).toHaveBeenCalledWith("[ChatWidget] createNew failed:", expect.any(Error));
      expect(err).toHaveBeenCalledWith("[ChatWidget] close failed:", expect.any(Error));
    });
  });

  describe("end-of-conversation survey", () => {
    it("is skipped entirely when disabled: close just closes", async () => {
      chatStore.getState().setTheme({ endOfConversationSurvey: { enabled: false } });
      const el = await mountWidget();
      await openWidget(el);
      fire(el, "chat-close-requested");
      expect(chatStore.getState().isOpened).toBe(false);
    });

    it("manual trigger does not intercept close", async () => {
      chatStore.getState().setTheme({ endOfConversationSurvey: { trigger: "manual" } });
      const el = await mountWidget();
      await openWidget(el);
      fire(el, "chat-close-requested");
      expect(chatStore.getState().isOpened).toBe(false);
    });

    it("screen mode: close shows the overlay; submit sends the survey; close resets the session", async () => {
      const resets = listen(document, "chativa-reset");
      const el = await mountWidget();
      await openWidget(el);
      messageStore.getState().addMessage({ id: "m1", type: "text", from: "bot", data: { text: "hi" } });

      fire(el, "chat-close-requested");
      await el.updateComplete;
      expect(chatStore.getState().isOpened).toBe(true);
      const survey = $<LitLike & { overlay: boolean }>(el, "end-of-conversation-survey")!;
      expect(survey.overlay).toBe(true);
      expect($(el, "chat-message-list")).toBeNull();

      fire(el, "survey-submitted", { rating: 4, comment: "ok", kind: 1, messageId: "" });
      await flush();
      expect(connector.sendSurvey).toHaveBeenCalledWith({ rating: 4, comment: "ok", kind: 1 });

      fire(el, "survey-close");
      await flush();
      expect(resets).toHaveLength(1);
      expect(connector.disconnect).toHaveBeenCalled();
      expect(chatStore.getState().isOpened).toBe(false);
      expect(chatStore.getState().connectorStatus).toBe("idle");
      expect(messageStore.getState().messages).toHaveLength(0);

      // The rebuilt engine connects again on the next open.
      await openWidget(el);
      expect(connector.connect).toHaveBeenCalledTimes(2);
      expect($(el, "end-of-conversation-survey")).toBeNull();
    });

    it("a second close while the overlay is showing resets instead of re-asking", async () => {
      const el = await mountWidget();
      await openWidget(el);
      fire(el, "chat-close-requested");
      await el.updateComplete;
      fire(el, "chat-close-requested");
      await flush();
      expect(chatStore.getState().isOpened).toBe(false);
      expect(connector.disconnect).toHaveBeenCalled();
    });

    it("skip resets the conversation", async () => {
      const el = await mountWidget();
      await openWidget(el);
      fire(el, "chat-close-requested");
      await el.updateComplete;
      fire(el, "survey-skipped");
      await flush();
      expect(chatStore.getState().isOpened).toBe(false);
      expect(connector.sendSurvey).not.toHaveBeenCalled();
    });

    it("resetOnSubmit: false keeps the session and re-arms the survey", async () => {
      chatStore.getState().setTheme({ endOfConversationSurvey: { resetOnSubmit: false } });
      const el = await mountWidget();
      await openWidget(el);
      fire(el, "chat-close-requested");
      await el.updateComplete;
      fire(el, "survey-skipped");
      await flush();
      expect(chatStore.getState().isOpened).toBe(false);
      expect(connector.disconnect).not.toHaveBeenCalled();

      await openWidget(el);
      fire(el, "chat-close-requested");
      await el.updateComplete;
      expect($(el, "end-of-conversation-survey")).not.toBeNull();
    });

    it("inline mode appends a survey message and keeps the widget open", async () => {
      chatStore.getState().setTheme({ endOfConversationSurvey: { mode: "inline" } });
      const el = await mountWidget();
      await openWidget(el);
      fire(el, "chat-close-requested");
      await el.updateComplete;

      const last = messageStore.getState().messages.at(-1)!;
      expect(last.type).toBe("end-of-conversation-survey");
      expect(last.from).toBe("bot");
      expect(chatStore.getState().isOpened).toBe(true);

      fire(el, "chat-close-requested");
      await flush();
      expect(chatStore.getState().isOpened).toBe(false);
    });

    it("chat-reset-survey-state lets the survey be shown again", async () => {
      chatStore.getState().setTheme({ endOfConversationSurvey: { mode: "inline" } });
      const el = await mountWidget();
      await openWidget(el);
      fire(el, "chat-close-requested");
      fire(el, "chat-reset-survey-state");
      fire(el, "chat-close-requested");
      const surveys = messageStore.getState().messages.filter((m) => m.type === "end-of-conversation-survey");
      expect(surveys.length).toBeGreaterThanOrEqual(1);
      expect(chatStore.getState().isOpened).toBe(true);
    });

    it("logs a failing sendSurvey", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      connector.sendSurvey.mockRejectedValueOnce(new Error("nope"));
      const el = await mountWidget();
      await openWidget(el);
      fire(el, "survey-submitted", { rating: 5 });
      await flush();
      expect(err).toHaveBeenCalledWith("[ChatWidget] sendSurvey failed:", expect.any(Error));
    });
  });

  describe("keyboard", () => {
    it("Escape closes the open widget (through the survey flow) and is ignored while closed", async () => {
      chatStore.getState().setTheme({ endOfConversationSurvey: { enabled: false } });
      const el = await mountWidget();
      const ignored = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
      document.dispatchEvent(ignored);
      expect(ignored.defaultPrevented).toBe(false);

      await openWidget(el);
      const esc = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
      document.dispatchEvent(esc);
      expect(esc.defaultPrevented).toBe(true);
      expect(chatStore.getState().isOpened).toBe(false);
    });

    it("traps Tab focus inside the dialog", async () => {
      chatStore.getState().setConnectorStatus("connected");
      const el = await mountWidget();
      await openWidget(el);

      const outside = document.createElement("button");
      document.body.appendChild(outside);
      outside.focus();

      const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
      document.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(el); // focus moved into the shadow tree

      const shiftTab = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true });
      outside.focus();
      document.dispatchEvent(shiftTab);
      expect(shiftTab.defaultPrevented).toBe(true);

      const other = new KeyboardEvent("keydown", { key: "a", cancelable: true });
      document.dispatchEvent(other);
      expect(other.defaultPrevented).toBe(false);
    });
  });

  describe("file drop", () => {
    const dragEvent = (type: string, dt: unknown) => {
      const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown };
      Object.defineProperty(ev, "dataTransfer", { value: dt });
      return ev;
    };

    it("shows the drop overlay for file drags and forwards dropped files to the input", async () => {
      chatStore.getState().setConnectorStatus("connected");
      const el = await mountWidget();
      await openWidget(el);
      const w = dialog(el)!;

      w.dispatchEvent(dragEvent("dragenter", { types: ["Files"] }));
      w.dispatchEvent(dragEvent("dragenter", { types: ["Files"] })); // child element
      await el.updateComplete;
      expect($(el, ".drop-overlay-label")!.textContent).toBe("Drop files here");

      const over = dragEvent("dragover", { types: ["Files"] });
      w.dispatchEvent(over);
      expect(over.defaultPrevented).toBe(true);

      w.dispatchEvent(dragEvent("dragleave", {}));
      await el.updateComplete;
      expect($(el, ".drop-overlay")).not.toBeNull(); // still inside the outer element
      w.dispatchEvent(dragEvent("dragleave", {}));
      await el.updateComplete;
      expect($(el, ".drop-overlay")).toBeNull();

      const f = new File(["x"], "dropped.txt");
      w.dispatchEvent(dragEvent("dragenter", { types: ["Files"] }));
      w.dispatchEvent(dragEvent("drop", { files: [f] }));
      await el.updateComplete;
      expect($(el, ".drop-overlay")).toBeNull();
      const input = $(el, "chat-input")! as LitLike;
      await input.updateComplete;
      expect(input.shadowRoot!.querySelector(".file-chip-name")!.textContent).toBe("dropped.txt");
    });

    it("ignores non-file drags and empty drops", async () => {
      const el = await mountWidget();
      await openWidget(el);
      const w = dialog(el)!;
      const enter = dragEvent("dragenter", { types: ["text/plain"] });
      w.dispatchEvent(enter);
      w.dispatchEvent(dragEvent("dragover", { types: ["text/plain"] }));
      await el.updateComplete;
      expect(enter.defaultPrevented).toBe(false);
      expect($(el, ".drop-overlay")).toBeNull();

      w.dispatchEvent(dragEvent("drop", { files: [] }));
      await el.updateComplete;
      const input = $(el, "chat-input")! as LitLike;
      expect(input.shadowRoot!.querySelector(".file-chip")).toBeNull();
    });
  });

  describe("mobile visual viewport", () => {
    it("mirrors the visual viewport into CSS variables on narrow screens", async () => {
      const vv = Object.assign(new EventTarget(), { offsetTop: 12.4, height: 500.6 });
      Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
      const width = window.innerWidth;
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 });
      try {
        const el = await mountWidget();
        vv.dispatchEvent(new Event("resize"));
        vv.dispatchEvent(new Event("scroll")); // throttled into the same frame
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        expect(el.style.getPropertyValue("--_vv-top")).toBe("12px");
        expect(el.style.getPropertyValue("--_vv-height")).toBe("501px");
        el.remove();
      } finally {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
        delete (window as unknown as { visualViewport?: unknown }).visualViewport;
      }
    });
  });

  it("renders the conversation list only when multi-conversation is enabled", async () => {
    const el = await mountWidget();
    await openWidget(el);
    fire(el, "show-conversations");
    await el.updateComplete;
    expect($(el, "conversation-list")).toBeNull();
    expect($$(el, "chat-message-list")).toHaveLength(1);
  });
});
