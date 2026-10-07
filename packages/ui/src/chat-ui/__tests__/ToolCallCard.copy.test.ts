import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatStore, EventBus, type ToolCall } from "@chativa/core";
import "../ToolCallCard";
import { $, $$, flush, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

type Card = LitLike & { toolCall: ToolCall | null };

const done: ToolCall = { id: "t2", name: "weather", status: "completed", params: { city: "Paris" }, result: { temp: 21 } };
const failed: ToolCall = { id: "t3", name: "lookup", status: "error", params: { id: 7 }, error: "Timeout" };

let writeText: ReturnType<typeof vi.fn>;

async function openCard(tc: ToolCall): Promise<Card> {
  const el = await mount<Card>("tool-call-card", { toolCall: tc });
  if (!$(el, ".body")) {
    $<HTMLButtonElement>(el, ".head")!.click();
    await el.updateComplete;
  }
  return el;
}

const copyButton = (el: Card, part: string) => $<HTMLButtonElement>(el, `.copy-btn[data-part="${part}"]`)!;

describe("ToolCallCard — copy buttons", () => {
  beforeEach(() => {
    resetGlobals();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    EventBus.clear();
    vi.useRealTimers();
    resetGlobals();
  });

  it("adds a labelled copy button to the parameters and result sections", async () => {
    const el = await openCard(done);
    expect($$<HTMLButtonElement>(el, ".copy-btn").map((b) => b.dataset.part)).toEqual(["params", "result"]);
    expect(copyButton(el, "params").getAttribute("aria-label")).toBe("Copy: Parameters");
    expect(copyButton(el, "result").getAttribute("aria-label")).toBe("Copy: Result");
  });

  it("copies the pretty-printed JSON shown in the section and reports tool_call_copied", async () => {
    const events: unknown[] = [];
    EventBus.on("tool_call_copied", (e) => events.push(e));
    const el = await openCard(done);

    copyButton(el, "params").click();
    await flush();
    copyButton(el, "result").click();
    await flush();

    expect(writeText.mock.calls.map((c) => c[0])).toEqual([
      JSON.stringify({ city: "Paris" }, null, 2),
      JSON.stringify({ temp: 21 }, null, 2),
    ]);
    expect(events).toEqual([
      { toolCallId: "t2", part: "params" },
      { toolCallId: "t2", part: "result" },
    ]);
  });

  it("copies the error text of a failed call", async () => {
    const el = await openCard(failed);
    expect($$<HTMLButtonElement>(el, ".copy-btn").map((b) => b.dataset.part)).toEqual(["params", "error"]);
    copyButton(el, "error").click();
    await flush();
    expect(writeText).toHaveBeenCalledWith("Timeout");
  });

  it("shows Copied on the clicked section only, then resets", async () => {
    vi.useFakeTimers();
    const el = await openCard(done);
    copyButton(el, "result").click();
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;

    expect(copyButton(el, "result").classList.contains("copied")).toBe(true);
    expect(copyButton(el, "result").getAttribute("aria-label")).toBe("Copied");
    expect(copyButton(el, "params").classList.contains("copied")).toBe(false);

    await vi.advanceTimersByTimeAsync(1600);
    await el.updateComplete;
    expect(copyButton(el, "result").classList.contains("copied")).toBe(false);
  });

  it("no event and no confirmation when the clipboard write fails", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const events: unknown[] = [];
    EventBus.on("tool_call_copied", (e) => events.push(e));
    const el = await openCard(done);
    copyButton(el, "params").click();
    await flush();
    await el.updateComplete;
    expect(events).toEqual([]);
    expect(copyButton(el, "params").classList.contains("copied")).toBe(false);
  });

  it("theme.messageActions.codeBlockCopy: false hides the buttons", async () => {
    chatStore.getState().setTheme({ messageActions: { codeBlockCopy: false } });
    const el = await openCard(done);
    expect($(el, ".copy-btn")).toBeNull();
    expect($(el, ".section-label")!.textContent).toBe("Parameters");
  });
});
