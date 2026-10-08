import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chatStore,
  messageStore,
  EventBus,
  MessageActionRegistry,
  type MessageActionSupport,
  type StoredMessage,
} from "@chativa/core";
import "../ChatMessageList";
import "../DefaultTextMessage";
import { resolveBuiltInActions, type BuiltInMessageActions } from "../MessageActions";
import { copyText, markdownToPlainText } from "../../utils/clipboard";
import i18next from "../../i18n/i18n";
import { $, $$, flush, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

const bot = (id: string, text: string, data: Record<string, unknown> = {}): StoredMessage =>
  ({ id, type: "text", from: "bot", data: { text, ...data }, timestamp: 1 });
const user = (id: string, text: string): StoredMessage =>
  ({ id, type: "text", from: "user", data: { text }, timestamp: 1 });

const SUPPORTED: MessageActionSupport = { regenerate: "supported", editMessage: "supported" };
const UNSUPPORTED: MessageActionSupport = { regenerate: "unsupported", editMessage: "unsupported" };

const cleanups: (() => void)[] = [];
function listen(type: string) {
  const events: CustomEvent[] = [];
  const fn = (e: Event) => events.push(e as CustomEvent);
  document.addEventListener(type, fn);
  cleanups.push(() => document.removeEventListener(type, fn));
  return events;
}

let writeText: ReturnType<typeof vi.fn>;
function stubClipboard() {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  cleanups.push(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });
}

beforeEach(() => {
  resetGlobals();
  stubClipboard();
});

afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn());
  EventBus.clear();
  vi.useRealTimers();
  resetGlobals();
});

// ── visibility rules ──────────────────────────────────────────────────

describe("resolveBuiltInActions", () => {
  const messages = [user("u1", "hi"), bot("b1", "one"), user("u2", "again"), bot("b2", "two"), bot("b3", "three")];
  const resolve = (id: string, over: Partial<Parameters<typeof resolveBuiltInActions>[1]> = {}) =>
    resolveBuiltInActions(messages.find((m) => m.id === id)!, {
      messages,
      config: undefined,
      support: SUPPORTED,
      isTyping: false,
      ...over,
    });

  it("regenerate only on the last bubble of the latest reply, edit only on the latest user message", () => {
    expect(resolve("b3")).toEqual({ copy: true, regenerate: true, edit: false });
    expect(resolve("b2").regenerate).toBe(false);
    expect(resolve("b1").regenerate).toBe(false);
    expect(resolve("u2")).toEqual({ copy: false, regenerate: false, edit: true });
    expect(resolve("u1").edit).toBe(false);
  });

  it("hides regenerate / edit when the connector does not support them", () => {
    expect(resolve("b3", { support: UNSUPPORTED })).toEqual({ copy: true, regenerate: false, edit: false });
    expect(resolve("u2", { support: UNSUPPORTED }).edit).toBe(false);
  });

  it("the fallback option shows unsupported actions, but never denied ones", () => {
    const config = { fallback: true };
    expect(resolve("b3", { support: UNSUPPORTED, config }).regenerate).toBe(true);
    expect(resolve("u2", { support: UNSUPPORTED, config }).edit).toBe(true);
    const denied: MessageActionSupport = { regenerate: "denied", editMessage: "denied" };
    expect(resolve("b3", { support: denied, config }).regenerate).toBe(false);
    expect(resolve("u2", { support: denied, config }).edit).toBe(false);
  });

  it("hides regenerate / edit while the bot is typing or the reply is streaming", () => {
    expect(resolve("b3", { isTyping: true }).regenerate).toBe(false);
    expect(resolve("u2", { isTyping: true }).edit).toBe(false);

    const streaming = [...messages.slice(0, -1), bot("b3", "thr", { streaming: true })];
    const r = resolveBuiltInActions(streaming[4], { messages: streaming, config: undefined, support: SUPPORTED, isTyping: false });
    expect(r).toEqual({ copy: false, regenerate: false, edit: false });
  });

  it("theme flags turn each built-in off", () => {
    const config = { copy: false, regenerate: false, edit: false };
    expect(resolve("b3", { config })).toEqual({ copy: false, regenerate: false, edit: false });
    expect(resolve("u2", { config }).edit).toBe(false);
  });

  it("no copy for bot messages without text; no regenerate without a user message", () => {
    const card: StoredMessage = { id: "c", type: "card", from: "bot", data: { title: "x" } };
    const only = [card];
    expect(resolveBuiltInActions(card, { messages: only, config: undefined, support: SUPPORTED, isTyping: false }))
      .toEqual({ copy: false, regenerate: false, edit: false });
  });
});

// ── clipboard helpers ─────────────────────────────────────────────────

describe("clipboard utils", () => {
  it("markdownToPlainText strips Markdown and keeps one line per block", () => {
    expect(markdownToPlainText("**Hello** [world](https://x.y)\n\n- one\n- `two`")).toBe("Hello world\n\none\ntwo");
  });

  it("copyText uses the Clipboard API", async () => {
    await expect(copyText("abc")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("abc");
  });

  it("copyText falls back to execCommand when the Clipboard API is missing or refuses", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
    cleanups.push(() => { delete (document as unknown as Record<string, unknown>).execCommand; });

    await expect(copyText("abc")).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull(); // cleaned up
  });
});

// ── <message-actions> ─────────────────────────────────────────────────

type ActionsEl = LitLike & { message: StoredMessage; builtIns: BuiltInMessageActions; isLatest: boolean; active: boolean };

async function renderActions(message: StoredMessage, builtIns: Partial<BuiltInMessageActions>, isLatest = true) {
  return mount<ActionsEl>("message-actions", {
    message,
    isLatest,
    builtIns: { copy: false, regenerate: false, edit: false, ...builtIns },
  });
}

describe("<message-actions>", () => {
  it("renders nothing when no action applies", async () => {
    const el = await renderActions(bot("b", "x"), {});
    expect($(el, ".actions")).toBeNull();
  });

  it("copy writes plain text, confirms, and reports message_copied", async () => {
    const copied: unknown[] = [];
    EventBus.on("message_copied", (e) => copied.push(e));
    const el = await renderActions(bot("b1", "**bold** text"), { copy: true });
    const btn = $<HTMLButtonElement>(el, ".copy")!;
    expect(btn.getAttribute("aria-label")).toBe("Copy");

    btn.click();
    await flush();
    await el.updateComplete;

    expect(writeText).toHaveBeenCalledWith("bold text");
    expect(copied).toEqual([{ messageId: "b1", format: "text" }]);
    expect($(el, ".copy")!.getAttribute("aria-label")).toBe("Copied");
    expect($(el, "[role=status]")!.textContent).toBe("Copied");
    expect(el.active).toBe(true);
  });

  it("Shift+copy writes the raw Markdown", async () => {
    const el = await renderActions(bot("b1", "**bold** text"), { copy: true });
    $(el, ".copy")!.dispatchEvent(new MouseEvent("click", { shiftKey: true, bubbles: true }));
    await flush();
    expect(writeText).toHaveBeenCalledWith("**bold** text");
  });

  it("the Copied confirmation resets after a moment", async () => {
    vi.useFakeTimers();
    const el = await renderActions(bot("b1", "x"), { copy: true });
    $(el, ".copy")!.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(el.active).toBe(true);
    await vi.advanceTimersByTimeAsync(1600);
    await el.updateComplete;
    expect(el.active).toBe(false);
    expect($(el, ".copy")!.getAttribute("aria-label")).toBe("Copy");
  });

  it("regenerate and edit dispatch composed events with the message id", async () => {
    const regen = listen("chativa-regenerate");
    const edit = listen("chativa-edit-start");
    const el = await renderActions(bot("b1", "x"), { regenerate: true, edit: true });
    $(el, ".regenerate")!.click();
    $(el, ".edit")!.click();
    expect(regen[0].detail).toEqual({ messageId: "b1" });
    expect(regen[0].composed).toBe(true);
    expect(edit[0].detail).toEqual({ messageId: "b1" });
  });

  it("renders registered custom actions and runs them with the message context", async () => {
    const execute = vi.fn();
    MessageActionRegistry.register({ name: "share", label: () => "Share", icon: "<path d='M1 1'/>", placement: "inline", execute });
    MessageActionRegistry.register({ name: "report", label: "Report", appliesTo: "user", placement: "inline", execute: vi.fn() });
    const msg = bot("b1", "x");
    const el = await renderActions(msg, {}, false);

    const buttons = $$<HTMLButtonElement>(el, ".custom");
    expect(buttons.map((b) => b.dataset.action)).toEqual(["share"]);
    expect(buttons[0].getAttribute("aria-label")).toBe("Share");
    expect(buttons[0].querySelector("svg path")).not.toBeNull();

    buttons[0].click();
    expect(execute).toHaveBeenCalledWith({ message: msg, sender: "bot", isLatest: false });
  });

  it("renders an emoji icon as a text glyph, and falls back to the label without one", async () => {
    MessageActionRegistry.register({ name: "flag", label: "Report", icon: "🚩", placement: "inline", execute: vi.fn() });
    MessageActionRegistry.register({ name: "plain", label: "Plain", placement: "inline", execute: vi.fn() });
    const el = await renderActions(bot("b1", "x"), {});
    const [flag, plain] = $$<HTMLButtonElement>(el, ".custom");
    expect(flag.querySelector(".action-glyph")!.textContent).toBe("🚩");
    expect(flag.querySelector("svg")).toBeNull();
    expect(flag.getAttribute("aria-label")).toBe("Report");
    expect(plain.textContent!.trim()).toBe("Plain");
  });

  it("logs a failing custom action instead of throwing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    MessageActionRegistry.register({ name: "boom", label: "Boom", placement: "inline", execute: () => { throw new Error("x"); } });
    const el = await renderActions(bot("b1", "x"), {});
    $(el, ".custom")!.click();
    await flush();
    expect(err).toHaveBeenCalledWith('[message-actions] "boom" failed:', expect.any(Error));
    err.mockRestore();
  });
});

describe("<message-actions> — localized labels", () => {
  afterEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("uses the translation for the active language and updates on a language switch", async () => {
    MessageActionRegistry.register({
      name: "share",
      label: "Share",
      icon: "📤",
      translations: { tr: "Paylaş", de: "Teilen" },
      execute: vi.fn(),
    });
    MessageActionRegistry.register({
      name: "pin",
      label: "Pin",
      placement: "inline",
      translations: { tr: "Sabitle" },
      execute: vi.fn(),
    });
    const el = await renderActions(bot("b1", "x"), {});
    const open = async () => {
      $<HTMLButtonElement>(el, ".more-btn")!.click();
      await el.updateComplete;
    };

    await open();
    expect($(el, ".menu-item")!.textContent).toContain("Share");
    expect($(el, ".custom")!.getAttribute("aria-label")).toBe("Pin");

    await i18next.changeLanguage("tr");
    await el.updateComplete;
    expect($(el, ".menu-item")!.textContent).toContain("Paylaş");
    expect($(el, ".custom")!.getAttribute("aria-label")).toBe("Sabitle");
    expect($(el, ".more-btn")!.getAttribute("aria-label")).toBe("Diğer işlemler");

    await i18next.changeLanguage("fr"); // not translated → falls back to label
    await el.updateComplete;
    expect($(el, ".menu-item")!.textContent).toContain("Share");
  });
});

// ── "⋮" overflow menu ─────────────────────────────────────────────────

describe("<message-actions> — overflow menu", () => {
  async function renderWithMenu() {
    const share = vi.fn();
    const report = vi.fn();
    MessageActionRegistry.register({ name: "share", label: "Share", icon: "📤", execute: share });
    MessageActionRegistry.register({ name: "report", label: "Report", icon: "🚩", execute: report });
    MessageActionRegistry.register({ name: "pin", label: "Pin", placement: "inline", execute: vi.fn() });
    const el = await renderActions(bot("b1", "x"), { copy: true });
    return { el, share, report };
  }
  const trigger = (el: ActionsEl) => $<HTMLButtonElement>(el, ".more-btn")!;
  const items = (el: ActionsEl) => $$<HTMLButtonElement>(el, ".menu-item");

  it("puts custom actions in a closed menu by default; inline ones stay on the bar", async () => {
    const { el } = await renderWithMenu();
    expect($$<HTMLButtonElement>(el, ".custom").map((b) => b.dataset.action)).toEqual(["pin"]);
    expect(trigger(el).getAttribute("aria-label")).toBe("More actions");
    expect(trigger(el).getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger(el).getAttribute("aria-expanded")).toBe("false");
    expect($(el, ".menu")).toBeNull();
  });

  it("no menu trigger when every custom action is inline", async () => {
    MessageActionRegistry.register({ name: "pin", label: "Pin", placement: "inline", execute: vi.fn() });
    const el = await renderActions(bot("b1", "x"), {});
    expect($(el, ".more-btn")).toBeNull();
  });

  it("opens with icon + label items, keeps the bar active, runs the chosen action and closes", async () => {
    const { el, share } = await renderWithMenu();
    trigger(el).click();
    await el.updateComplete;

    expect(trigger(el).getAttribute("aria-expanded")).toBe("true");
    expect($(el, ".menu")!.getAttribute("role")).toBe("menu");
    expect(items(el).map((i) => i.textContent!.replace(/\s+/g, " ").trim())).toEqual(["📤 Share", "🚩 Report"]);
    expect(el.active).toBe(true);
    expect(el.shadowRoot!.activeElement).toBe(items(el)[0]);

    items(el)[0].click();
    await el.updateComplete;
    await flush();
    expect(share).toHaveBeenCalledWith({ message: el.message, sender: "bot", isLatest: true });
    expect($(el, ".menu")).toBeNull();
    expect(el.active).toBe(false);
  });

  it("arrow keys move focus, wrapping; Escape closes without bubbling and refocuses the trigger", async () => {
    const keydowns = listen("keydown");
    const { el } = await renderWithMenu();
    trigger(el).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await el.updateComplete;
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).toBe(items(el)[1]); // ArrowUp opens on the last item

    const menu = $(el, ".menu")!;
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(el.shadowRoot!.activeElement).toBe(items(el)[0]); // wrapped
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(el.shadowRoot!.activeElement).toBe(items(el)[1]);

    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    await el.updateComplete;
    await el.updateComplete;
    expect($(el, ".menu")).toBeNull();
    expect(keydowns).toHaveLength(0);
    expect(el.shadowRoot!.activeElement).toBe(trigger(el));
  });

  it("closes on a pointer press outside, but not inside", async () => {
    const { el } = await renderWithMenu();
    trigger(el).click();
    await el.updateComplete;

    $(el, ".menu")!.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));
    await el.updateComplete;
    expect($(el, ".menu")).not.toBeNull();

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await el.updateComplete;
    expect($(el, ".menu")).toBeNull();
  });

  it("the trigger toggles the menu closed again", async () => {
    const { el } = await renderWithMenu();
    trigger(el).click();
    await el.updateComplete;
    trigger(el).click();
    await el.updateComplete;
    expect($(el, ".menu")).toBeNull();
  });
});

// ── chat-message-list integration ─────────────────────────────────────

describe("chat-message-list — message actions", () => {
  async function renderList(support: MessageActionSupport = SUPPORTED) {
    chatStore.setState({ messageActionSupport: support, connectorStatus: "connected" });
    for (const m of [user("u1", "hi"), bot("b1", "one"), bot("b2", "two")]) messageStore.getState().addMessage(m);
    const el = await mount<LitLike>("chat-message-list");
    await Promise.all($$<LitLike>(el, "message-actions").map((a) => a.updateComplete));
    return el;
  }
  const actionsOf = (el: LitLike, sel: string) =>
    $<LitLike>(el, `${sel} message-actions`)!.shadowRoot!;

  it("puts copy on every bot text, regenerate on the last bubble and edit on the user message", async () => {
    const el = await renderList();
    const bots = $$<LitLike>(el, ".bot-message message-actions");
    expect(bots.map((b) => !!b.shadowRoot!.querySelector(".copy"))).toEqual([true, true]);
    expect(bots.map((b) => !!b.shadowRoot!.querySelector(".regenerate"))).toEqual([false, true]);
    expect(actionsOf(el, ".user-message").querySelector(".edit")).not.toBeNull();
  });

  it("orders a bot toolbar feedback first, then the action bar (so the ⋮ menu is last)", async () => {
    MessageActionRegistry.register({ name: "share", label: "Share", icon: "📤", execute: vi.fn() });
    const el = await renderList();
    const toolbar = $$<HTMLElement>(el, ".bot-message .message-toolbar")[1];
    expect([...toolbar.children].map((c) => c.tagName.toLowerCase())).toEqual(["message-feedback", "message-actions"]);
    const bar = toolbar.querySelector<LitLike>("message-actions")!;
    await bar.updateComplete;
    const buttons = [...bar.shadowRoot!.querySelectorAll<HTMLElement>(".actions > button, .actions > .more")];
    expect(buttons.map((b) => b.className.split(" ").find((c) => ["copy", "regenerate", "more"].includes(c))))
      .toEqual(["copy", "regenerate", "more"]);
  });

  it("shows no regenerate / edit when the connector lacks support", async () => {
    const el = await renderList(UNSUPPORTED);
    expect($$<LitLike>(el, "message-actions").some((a) => a.shadowRoot!.querySelector(".regenerate, .edit"))).toBe(false);
  });

  it("edit opens an inline editor; saving dispatches chativa-edit-message", async () => {
    const edits = listen("chativa-edit-message");
    const el = await renderList();
    (actionsOf(el, ".user-message").querySelector(".edit") as HTMLButtonElement).click();
    await el.updateComplete;

    const ta = $<HTMLTextAreaElement>(el, ".edit-input")!;
    expect(ta.value).toBe("hi");
    expect(ta.getAttribute("aria-label")).toBe("Edit your message");
    expect($(el, ".user-message")).toBeNull(); // the bubble is replaced by the editor

    ta.value = "hello there";
    ta.dispatchEvent(new Event("input"));
    await el.updateComplete;
    $<HTMLButtonElement>(el, ".edit-btn.save")!.click();
    await el.updateComplete;

    expect(edits.map((e) => e.detail)).toEqual([{ messageId: "u1", text: "hello there" }]);
    expect($(el, ".edit-form")).toBeNull();
  });

  it("Enter saves, Escape cancels without bubbling, and an empty text disables Send", async () => {
    const edits = listen("chativa-edit-message");
    const escapes = listen("keydown");
    const el = await renderList();
    const startEdit = async () => {
      (actionsOf(el, ".user-message").querySelector(".edit") as HTMLButtonElement).click();
      await el.updateComplete;
      return $<HTMLTextAreaElement>(el, ".edit-input")!;
    };

    let ta = await startEdit();
    ta.value = "  ";
    ta.dispatchEvent(new Event("input"));
    await el.updateComplete;
    expect($<HTMLButtonElement>(el, ".edit-btn.save")!.disabled).toBe(true);
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    await el.updateComplete;
    expect($(el, ".edit-form")).toBeNull();
    expect(escapes).toHaveLength(0);

    ta = await startEdit();
    ta.value = "changed";
    ta.dispatchEvent(new Event("input"));
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await el.updateComplete;
    expect(edits.map((e) => e.detail.text)).toEqual(["changed"]);
  });
});

// ── code-block copy ───────────────────────────────────────────────────

describe("default-text-message — code block copy", () => {
  const md = "Try this:\n\n```js\nconst a = 1;\n```";
  type TextEl = LitLike & { messageData: Record<string, unknown>; sender: string; messageId: string };
  const renderText = (data: Record<string, unknown>, sender = "bot") =>
    mount<TextEl>("default-text-message", { messageData: data, sender, messageId: "m1" });

  it("adds a copy button to each code block and copies its code", async () => {
    const copied: unknown[] = [];
    EventBus.on("message_copied", (e) => copied.push(e));
    const el = await renderText({ text: md });
    const btn = $<HTMLButtonElement>(el, ".code-block .code-copy")!;
    expect(btn.getAttribute("aria-label")).toBe("Copy code");

    btn.click();
    await flush();
    expect(writeText).toHaveBeenCalledWith("const a = 1;\n");
    expect(copied).toEqual([{ messageId: "m1", format: "code" }]);
    expect(btn.textContent).toBe("Copied");
  });

  it("keeps wide code inside the bubble: the block scrolls, the bubble may shrink", () => {
    const css = (customElements.get("default-text-message") as unknown as { styles: { cssText: string } }).styles.cssText;
    expect(css).toMatch(/\.content\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.bubble\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.message\.bot \.bubble pre\s*\{[^}]*overflow-x:\s*auto[^}]*max-width:\s*100%/);
    expect(css).toMatch(/\.message\.bot \.bubble pre::-webkit-scrollbar\s*\{\s*height:\s*8px/);
  });

  it("no copy button while streaming, on user messages, or with codeBlockCopy off", async () => {
    expect($(await renderText({ text: md, streaming: true }), ".code-copy")).toBeNull();
    expect($(await renderText({ text: md, _markdown: true }, "user"), ".code-copy")).toBeNull();
    chatStore.getState().setTheme({ messageActions: { codeBlockCopy: false } });
    expect($(await renderText({ text: md }), ".code-copy")).toBeNull();
  });
});
