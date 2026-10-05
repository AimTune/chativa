import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatStore, SlashCommandRegistry } from "@chativa/core";
import "../ChatInput";
import { registerCommand } from "../../commands/index";
import { $, $$, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

type Input = LitLike & { value: string; addFiles(files: File[]): void };

const cleanups: (() => void)[] = [];
function listen(type: string) {
  const events: CustomEvent[] = [];
  const fn = (e: Event) => events.push(e as CustomEvent);
  document.addEventListener(type, fn);
  cleanups.push(() => document.removeEventListener(type, fn));
  return events;
}

const textarea = (el: Input) => $<HTMLTextAreaElement>(el, ".text-input")!;
const sendBtn = (el: Input) => $<HTMLButtonElement>(el, ".send-btn")!;
const iconBtn = (el: Input, label: string) =>
  $$<HTMLButtonElement>(el, ".icon-btn").find((b) => b.getAttribute("aria-label") === label)!;

async function type(el: Input, text: string) {
  const ta = textarea(el);
  ta.value = text;
  ta.dispatchEvent(new Event("input"));
  await el.updateComplete;
}

async function key(el: Input, k: string, opts: KeyboardEventInit = {}) {
  const ev = new KeyboardEvent("keydown", { key: k, cancelable: true, ...opts });
  textarea(el).dispatchEvent(ev);
  await el.updateComplete;
  return ev;
}

const file = (name: string, size: number) => new File([new Uint8Array(size)], name);

async function render() {
  chatStore.getState().setConnectorStatus("connected");
  return mount<Input>("chat-input");
}

describe("ChatInput", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => {
    cleanups.splice(0).forEach((fn) => fn());
    resetGlobals();
  });

  describe("connection state", () => {
    it("disables every control while not connected and re-enables when connected", async () => {
      const el = await mount<Input>("chat-input");
      expect(textarea(el).disabled).toBe(true);
      expect(sendBtn(el).disabled).toBe(true);
      expect(iconBtn(el, "Emoji").disabled).toBe(true);
      expect(iconBtn(el, "Attach file").disabled).toBe(true);
      expect($(el, ".input-area")!.classList.contains("disconnected")).toBe(true);

      chatStore.getState().setConnectorStatus("connected");
      await el.updateComplete;
      expect(textarea(el).disabled).toBe(false);
      expect(iconBtn(el, "Emoji").disabled).toBe(false);
      expect($(el, ".input-area")!.classList.contains("disconnected")).toBe(false);
    });

    it("hides the attach button when theme.enableFileUpload is false", async () => {
      chatStore.getState().setTheme({ enableFileUpload: false });
      const el = await render();
      expect(iconBtn(el, "Attach file")).toBeUndefined();
      expect($(el, ".file-input")).toBeNull();
    });
  });

  describe("sending text", () => {
    it("send button is enabled only with non-blank text", async () => {
      const el = await render();
      expect(sendBtn(el).disabled).toBe(true);
      await type(el, "   ");
      expect(sendBtn(el).disabled).toBe(true);
      await type(el, "hi");
      expect(sendBtn(el).disabled).toBe(false);
    });

    it("clicking send dispatches trimmed send-message and clears the field", async () => {
      const sent = listen("send-message");
      const el = await render();
      await type(el, "  hello  ");
      sendBtn(el).click();
      await el.updateComplete;
      expect(sent.map((e) => e.detail)).toEqual(["hello"]);
      expect(sent[0].composed).toBe(true);
      expect(el.value).toBe("");
      expect(textarea(el).value).toBe("");
    });

    it("Enter sends, Shift+Enter does not", async () => {
      const sent = listen("send-message");
      const el = await render();
      await type(el, "line 1");
      const shift = await key(el, "Enter", { shiftKey: true });
      expect(shift.defaultPrevented).toBe(false);
      expect(sent).toHaveLength(0);

      const enter = await key(el, "Enter");
      expect(enter.defaultPrevented).toBe(true);
      expect(sent.map((e) => e.detail)).toEqual(["line 1"]);
    });

    it("Enter on an empty field sends nothing", async () => {
      const sent = listen("send-message");
      const el = await render();
      await key(el, "Enter");
      expect(sent).toHaveLength(0);
    });
  });

  describe("attachments", () => {
    it("queues files from the picker, shows chips with sizes and removes them", async () => {
      const el = await render();
      const input = $<HTMLInputElement>(el, ".file-input")!;
      const clickSpy = vi.spyOn(input, "click").mockImplementation(() => {});
      iconBtn(el, "Attach file").click();
      expect(clickSpy).toHaveBeenCalled();

      Object.defineProperty(input, "files", { value: [file("a.txt", 10), file("b.bin", 2048)], configurable: true });
      input.dispatchEvent(new Event("change"));
      await el.updateComplete;

      expect($$(el, ".file-chip-name").map((n) => n.textContent)).toEqual(["a.txt", "b.bin"]);
      expect($$(el, ".file-chip-size").map((n) => n.textContent)).toEqual(["10 B", "2.0 KB"]);
      expect(sendBtn(el).disabled).toBe(false); // files alone are sendable
      expect(iconBtn(el, "Attach file").classList.contains("active")).toBe(true);

      $<HTMLButtonElement>(el, ".file-chip-remove")!.click();
      await el.updateComplete;
      expect($$(el, ".file-chip-name").map((n) => n.textContent)).toEqual(["b.bin"]);
      expect($(el, ".file-chip-remove")!.getAttribute("aria-label")).toBe("Remove b.bin");
    });

    it("formats megabyte sizes", async () => {
      const el = await render();
      el.addFiles([file("big.iso", 3 * 1024 * 1024)]);
      await el.updateComplete;
      expect($(el, ".file-chip-size")!.textContent).toBe("3.0 MB");
    });

    it("sending with files dispatches send-file (with caption) instead of send-message", async () => {
      const files = listen("send-file");
      const texts = listen("send-message");
      const el = await render();
      const f = file("pic.png", 5);
      el.addFiles([f]);
      await type(el, "caption");
      sendBtn(el).click();
      await el.updateComplete;

      expect(texts).toHaveLength(0);
      expect(files).toHaveLength(1);
      expect(files[0].detail).toEqual({ files: [f], text: "caption" });
      expect($(el, ".file-previews")).toBeNull();
    });

    it("accepts dropped files and tracks the drag-over state", async () => {
      const el = await render();
      const area = $(el, ".input-area")!;
      area.dispatchEvent(new Event("dragover", { cancelable: true }));
      await el.updateComplete;
      expect(area.classList.contains("drag-over")).toBe(true);

      area.dispatchEvent(new Event("dragleave"));
      await el.updateComplete;
      expect(area.classList.contains("drag-over")).toBe(false);

      const drop = new Event("drop", { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown };
      Object.defineProperty(drop, "dataTransfer", { value: { files: [file("d.txt", 1)] } });
      const outer = vi.fn();
      document.addEventListener("drop", outer, { once: true });
      area.dispatchEvent(drop);
      await el.updateComplete;
      expect($$(el, ".file-chip-name").map((n) => n.textContent)).toEqual(["d.txt"]);
      expect(outer).not.toHaveBeenCalled(); // stopPropagation keeps the widget from double-adding
      document.removeEventListener("drop", outer);
    });

    it("a drop without files adds nothing", async () => {
      const el = await render();
      const drop = new Event("drop", { cancelable: true }) as Event & { dataTransfer: unknown };
      Object.defineProperty(drop, "dataTransfer", { value: { files: [] } });
      $(el, ".input-area")!.dispatchEvent(drop);
      await el.updateComplete;
      expect($(el, ".file-previews")).toBeNull();
    });
  });

  describe("emoji picker", () => {
    it("toggles the picker and inserts the selected emoji at the caret", async () => {
      const el = await render();
      await type(el, "ab");
      textarea(el).setSelectionRange(1, 1);

      iconBtn(el, "Emoji").click();
      await el.updateComplete;
      expect(iconBtn(el, "Emoji").getAttribute("aria-expanded")).toBe("true");
      const picker = $(el, "emoji-picker")!;
      picker.dispatchEvent(new CustomEvent("emoji-select", { detail: "😀" }));
      await el.updateComplete;

      expect(el.value).toBe("a😀b");
      expect($(el, "emoji-picker")).toBeNull();
    });

    it("closes on Escape and on a click outside, but not on a click inside", async () => {
      const el = await render();
      iconBtn(el, "Emoji").click();
      await el.updateComplete;

      $(el, ".picker-popup")!.click(); // inside — propagation stopped
      await el.updateComplete;
      expect($(el, "emoji-picker")).not.toBeNull();

      el.click(); // inside the component's composed path
      await el.updateComplete;
      expect($(el, "emoji-picker")).not.toBeNull();

      document.body.click();
      await el.updateComplete;
      expect($(el, "emoji-picker")).toBeNull();

      iconBtn(el, "Emoji").click();
      await el.updateComplete;
      await key(el, "Escape");
      expect($(el, "emoji-picker")).toBeNull();
    });
  });

  describe("slash commands", () => {
    let executed: { name: string; args: string }[];
    beforeEach(() => {
      executed = [];
      registerCommand({
        name: "help",
        translations: { en: { description: "Show help", usage: "[topic]" } },
        execute: ({ args }) => executed.push({ name: "help", args }),
      });
      registerCommand({
        name: "history",
        translations: { en: { description: "Show history" } },
        execute: ({ args }) => executed.push({ name: "history", args }),
      });
      registerCommand({
        name: "clear",
        translations: { en: { description: "Clear" } },
        execute: ({ args }) => executed.push({ name: "clear", args }),
      });
    });

    it("typing / opens a filtered suggestion list with usage and description", async () => {
      const el = await render();
      await type(el, "/h");
      const items = $$(el, ".slash-item");
      expect(items.map((i) => i.querySelector(".slash-item-name")!.textContent)).toEqual(["/help", "/history"]);
      expect(items[0].querySelector(".slash-item-usage")!.textContent).toBe("[topic]");
      expect(items[0].querySelector(".slash-item-desc")!.textContent).toBe("Show help");
      expect(items[1].querySelector(".slash-item-usage")).toBeNull();
      expect(textarea(el).getAttribute("aria-expanded")).toBe("true");
      expect(textarea(el).getAttribute("aria-controls")).toBe("slash-popup");

      await type(el, "hello");
      expect($(el, ".slash-popup")).toBeNull();
    });

    it("arrow keys move the focus (wrapping) and Enter completes the command", async () => {
      const el = await render();
      await type(el, "/h");
      expect($$(el, ".slash-item")[0].classList.contains("focused")).toBe(true);

      await key(el, "ArrowDown");
      expect($$(el, ".slash-item")[1].getAttribute("aria-selected")).toBe("true");
      await key(el, "ArrowDown");
      expect($$(el, ".slash-item")[0].classList.contains("focused")).toBe(true);
      await key(el, "ArrowUp");
      expect($$(el, ".slash-item")[1].classList.contains("focused")).toBe(true);

      const sent = listen("send-message");
      await key(el, "Enter");
      expect(el.value).toBe("/history ");
      expect($(el, ".slash-popup")).toBeNull();
      expect(sent).toHaveLength(0);
      expect(executed).toHaveLength(0);
    });

    it("Tab and clicking a suggestion complete the command; Escape dismisses the list", async () => {
      const el = await render();
      await type(el, "/he");
      await key(el, "Tab");
      expect(el.value).toBe("/help ");

      await type(el, "/c");
      $<HTMLButtonElement>(el, ".slash-item")!.click();
      await el.updateComplete;
      expect(el.value).toBe("/clear ");

      await type(el, "/");
      expect($$(el, ".slash-item")).toHaveLength(3);
      await key(el, "Escape");
      expect($(el, ".slash-popup")).toBeNull();
    });

    it("submitting an exact command executes it with args instead of sending text", async () => {
      const sent = listen("send-message");
      const el = await render();
      el.value = "/help billing  plans";
      await el.updateComplete;
      sendBtn(el).click();
      await el.updateComplete;

      expect(executed).toEqual([{ name: "help", args: "billing  plans" }]);
      expect(sent).toHaveLength(0);
      expect(el.value).toBe("");
    });

    it("an unknown /command is sent as a normal message", async () => {
      const sent = listen("send-message");
      const el = await render();
      el.value = "/unknown thing";
      await el.updateComplete;
      sendBtn(el).click();
      expect(sent.map((e) => e.detail)).toEqual(["/unknown thing"]);
      expect(executed).toHaveLength(0);
    });

    it("a click outside closes the suggestion list", async () => {
      const el = await render();
      await type(el, "/h");
      document.body.click();
      await el.updateComplete;
      expect($(el, ".slash-popup")).toBeNull();
    });

    it("registerCommand exposes localized description/usage getters", () => {
      const cmd = SlashCommandRegistry.get("help")!;
      expect(typeof cmd.description).toBe("function");
      expect((cmd.description as () => string)()).toBe("Show help");
      expect((cmd.usage as () => string)()).toBe("[topic]");
      expect((SlashCommandRegistry.get("history")!.usage as () => string)()).toBe("");
    });
  });

  it("re-renders on language change and stops after removal", async () => {
    const { i18next } = await import("@chativa/core");
    const el = await render();
    const spy = vi.spyOn(el as unknown as { requestUpdate(): void }, "requestUpdate");
    i18next.emit("languageChanged", "en");
    expect(spy).toHaveBeenCalled();
    el.remove();
    spy.mockClear();
    i18next.emit("languageChanged", "en");
    chatStore.getState().setConnectorStatus("error");
    expect(spy).not.toHaveBeenCalled();
  });
});
