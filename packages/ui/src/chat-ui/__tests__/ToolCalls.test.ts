import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolCall } from "@chativa/core";
import "../ToolCallActivity";
import "../ToolCallCard";
import { $, $$, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

type Card = LitLike & { toolCall: ToolCall | null };
type Activity = LitLike & { toolCalls: ToolCall[]; live: boolean };

const running: ToolCall = { id: "t1", name: "search", status: "running", description: "Searching the web", params: { q: "x" } };
const done: ToolCall = { id: "t2", name: "weather", status: "completed", params: { city: "Paris" }, result: { temp: 21 } };
const failed: ToolCall = { id: "t3", name: "lookup", status: "error", error: "Timeout" };

describe("ToolCallCard", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => resetGlobals());

  it("renders nothing without a tool call", async () => {
    const el = await mount<Card>("tool-call-card");
    expect($(el, ".card")).toBeNull();
  });

  it.each([
    [running, "running", "Running"],
    [done, "completed", "Completed"],
    [failed, "error", "Error"],
  ] as const)("shows the %s status chip", async (tc, cls, label) => {
    const el = await mount<Card>("tool-call-card", { toolCall: tc });
    const chip = $(el, ".chip")!;
    expect(chip.classList.contains(cls)).toBe(true);
    expect(chip.textContent!.trim()).toBe(label);
    expect($(el, ".name")!.textContent).toBe(tc.name);
    expect($(el, ".head")!.getAttribute("aria-label")).toBe(`${tc.name} — ${label}`);
  });

  it("is collapsed by default and expands to parameters + pretty-printed result", async () => {
    const el = await mount<Card>("tool-call-card", { toolCall: done });
    expect($(el, ".body")).toBeNull();
    expect($(el, ".head")!.getAttribute("aria-expanded")).toBe("false");

    $(el, ".head")!.click();
    await el.updateComplete;
    const pres = $$(el, "pre").map((p) => p.textContent);
    expect(pres).toEqual([JSON.stringify({ city: "Paris" }, null, 2), JSON.stringify({ temp: 21 }, null, 2)]);
    expect($$(el, ".section-label").map((l) => l.textContent)).toEqual(["Parameters", "Result"]);
    expect($(el, ".chevron")!.classList.contains("open")).toBe(true);

    $(el, ".head")!.click();
    await el.updateComplete;
    expect($(el, ".body")).toBeNull();
  });

  it("shows the full name and description on hover, and the description when expanded", async () => {
    const el = await mount<Card>("tool-call-card", { toolCall: { ...running, name: "a-rather-long-tool-name-that-truncates" } });
    expect($(el, ".name")!.getAttribute("title")).toBe("a-rather-long-tool-name-that-truncates — Searching the web");

    $(el, ".head")!.click();
    await el.updateComplete;
    expect($(el, ".description")!.textContent).toBe("Searching the web");

    const plain = await mount<Card>("tool-call-card", { toolCall: done });
    expect($(plain, ".name")!.getAttribute("title")).toBe("weather");
    $(plain, ".head")!.click();
    await plain.updateComplete;
    expect($(plain, ".description")).toBeNull();
  });

  it("prints string results verbatim and survives non-serialisable results", async () => {
    const str = await mount<Card>("tool-call-card", { toolCall: { ...done, id: "s", params: undefined, result: "plain text" } });
    $(str, ".head")!.click();
    await str.updateComplete;
    expect($$(str, "pre").map((p) => p.textContent)).toEqual(["plain text"]);

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const circ = await mount<Card>("tool-call-card", { toolCall: { ...done, id: "c", params: undefined, result: circular } });
    $(circ, ".head")!.click();
    await circ.updateComplete;
    expect($(circ, "pre")!.textContent).toBe("[object Object]");
  });

  it("guards against null / empty params from the wire", async () => {
    const el = await mount<Card>("tool-call-card", {
      toolCall: { ...done, params: null as unknown as Record<string, unknown>, result: undefined },
    });
    $(el, ".head")!.click();
    await el.updateComplete;
    expect($(el, ".body")).not.toBeNull();
    expect($$(el, "pre")).toHaveLength(0);
  });

  it("auto-expands errors once and shows the error box", async () => {
    const el = await mount<Card>("tool-call-card", { toolCall: failed });
    expect($(el, ".error-box")!.textContent).toBe("Timeout");

    // User collapses — a later update of the same call must not re-open it.
    $(el, ".head")!.click();
    await el.updateComplete;
    el.toolCall = { ...failed, error: "Timeout again" };
    await el.updateComplete;
    expect($(el, ".body")).toBeNull();
  });

  it("a running call that later fails is auto-expanded", async () => {
    const el = await mount<Card>("tool-call-card", { toolCall: { ...running, id: "r" } });
    expect($(el, ".body")).toBeNull();
    el.toolCall = { ...running, id: "r", status: "error", error: "Boom" };
    await el.updateComplete;
    expect($(el, ".error-box")!.textContent).toBe("Boom");
  });
});

describe("ToolCallActivity", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => resetGlobals());

  it("renders nothing without tool calls", async () => {
    const el = await mount<Activity>("tool-call-activity");
    expect($(el, ".line")).toBeNull();
  });

  it("attached mode summarises unique tool names, count and failures", async () => {
    const el = await mount<Activity>("tool-call-activity", {
      toolCalls: [done, failed, { ...done, id: "t4" }],
    });
    expect($(el, ".names")!.textContent).toBe("weather, lookup");
    expect($(el, ".label")!.textContent).toContain("3 operations");
    expect($(el, ".count-error")!.textContent).toBe("1 failed");
    expect($(el, ".line")!.getAttribute("aria-label")).toBe("Toggle tool call details");
  });

  it("uses the singular summary and no failure count for one successful call", async () => {
    const el = await mount<Activity>("tool-call-activity", { toolCalls: [done] });
    expect($(el, ".label")!.textContent).toContain("1 operation");
    expect($(el, ".count-error")).toBeNull();
  });

  it("live mode shows the latest running tool with its description and a spinner", async () => {
    const el = await mount<Activity>("tool-call-activity", {
      live: true,
      toolCalls: [{ ...running, id: "a", name: "first" }, done, running],
    });
    expect($(el, ".spinner")).not.toBeNull();
    expect($(el, ".names")!.textContent).toBe("search");
    expect($(el, ".label")!.textContent).toContain("Searching the web");
  });

  it("live mode without a running call falls back to the summary", async () => {
    const el = await mount<Activity>("tool-call-activity", { live: true, toolCalls: [done] });
    expect($(el, ".spinner")).toBeNull();
    expect($(el, ".label")!.textContent).toContain("1 operation");
  });

  it("toggles the full trace of tool-call-cards", async () => {
    const el = await mount<Activity>("tool-call-activity", { toolCalls: [done, failed] });
    expect($(el, ".trace")).toBeNull();
    $(el, ".line")!.click();
    await el.updateComplete;
    const cards = $$<Card>(el, "tool-call-card");
    expect(cards.map((c) => c.toolCall?.id)).toEqual(["t2", "t3"]);
    expect($(el, ".line")!.getAttribute("aria-expanded")).toBe("true");
    $(el, ".line")!.click();
    await el.updateComplete;
    expect($(el, ".trace")).toBeNull();
  });
});
