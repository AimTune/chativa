import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../EmojiPicker";
import { $, $$, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

async function search(el: LitLike, q: string) {
  const input = $<HTMLInputElement>(el, ".search-input")!;
  input.value = q;
  input.dispatchEvent(new Event("input"));
  await el.updateComplete;
}

describe("EmojiPicker", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => resetGlobals());

  it("shows category tabs with the first one active and its emojis", async () => {
    const el = await mount("emoji-picker");
    const tabs = $$(el, ".tab");
    expect(tabs.map((t) => t.getAttribute("title"))).toEqual([
      "Smileys", "Gestures", "Hearts", "Animals", "Food", "Travel", "Objects", "Symbols",
    ]);
    expect(tabs[0].classList.contains("active")).toBe(true);
    expect($$(el, ".emoji-btn")[0].textContent).toBe("😀");
    expect($(el, ".search-input")!.getAttribute("placeholder")).toBe("Search emoji…");
  });

  it("switches categories when a tab is clicked", async () => {
    const el = await mount("emoji-picker");
    $$(el, ".tab")[4].click(); // Food
    await el.updateComplete;
    expect($$(el, ".tab")[4].classList.contains("active")).toBe(true);
    expect($$(el, ".emoji-btn")[0].textContent).toBe("🍎");
  });

  it("dispatches a composed emoji-select event with the emoji", async () => {
    const el = await mount("emoji-picker");
    const events: CustomEvent[] = [];
    document.addEventListener("emoji-select", (e) => events.push(e as CustomEvent), { once: true });
    $$(el, ".emoji-btn")[1].click();
    expect(events).toHaveLength(1);
    expect(events[0].detail).toBe("😃");
    expect(events[0].composed).toBe(true);
  });

  it("searches across all categories and deactivates tabs while searching", async () => {
    const el = await mount("emoji-picker");
    await search(el, "🍕");
    expect($$(el, ".emoji-btn").map((b) => b.textContent)).toEqual(["🍕"]);
    expect($$(el, ".tab.active")).toHaveLength(0);
  });

  it("shows a no-results message for an unmatched query", async () => {
    const el = await mount("emoji-picker");
    await search(el, "zzz");
    expect($(el, ".no-results")!.textContent).toBe("No results");
    expect($$(el, ".emoji-btn")).toHaveLength(0);
  });

  it("clicking a tab clears the search", async () => {
    const el = await mount("emoji-picker");
    await search(el, "zzz");
    $$(el, ".tab")[1].click();
    await el.updateComplete;
    expect($<HTMLInputElement>(el, ".search-input")!.value).toBe("");
    expect($$(el, ".emoji-btn")[0].textContent).toBe("👋");
  });

  it("whitespace-only search shows the active category", async () => {
    const el = await mount("emoji-picker");
    await search(el, "   ");
    expect($$(el, ".emoji-btn")[0].textContent).toBe("😀");
  });
});
