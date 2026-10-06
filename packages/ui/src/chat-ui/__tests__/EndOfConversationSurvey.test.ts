import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chatStore } from "@chativa/core";
import "../EndOfConversationSurvey";
import { $, $$, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

type Survey = LitLike & { messageId: string; overlay: boolean };

function listen(type: string) {
  const events: CustomEvent[] = [];
  const fn = (e: Event) => events.push(e as CustomEvent);
  document.addEventListener(type, fn);
  listeners.push([type, fn]);
  return events;
}
const listeners: [string, (e: Event) => void][] = [];

async function rate(el: Survey, n: number) {
  $$(el, ".star")[n - 1].click();
  await el.updateComplete;
}

async function comment(el: Survey, text: string) {
  const ta = $<HTMLTextAreaElement>(el, "textarea")!;
  ta.value = text;
  ta.dispatchEvent(new Event("input"));
  await el.updateComplete;
}

const submitBtn = (el: Survey) => $<HTMLButtonElement>(el, "button.primary")!;

describe("EndOfConversationSurvey", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => {
    for (const [t, fn] of listeners.splice(0)) document.removeEventListener(t, fn);
    resetGlobals();
  });

  it("renders the title, five unpressed stars and a disabled submit", async () => {
    const el = await mount<Survey>("end-of-conversation-survey");
    expect($(el, ".title")!.textContent).toBe("How did we do?");
    const stars = $$(el, ".star");
    expect(stars).toHaveLength(5);
    expect(stars[0].getAttribute("aria-label")).toBe("1 star");
    expect(stars[2].getAttribute("aria-label")).toBe("3 stars");
    expect(stars.every((s) => s.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(submitBtn(el).disabled).toBe(true);
  });

  it("honours a custom maxRating and falls back to 5 for invalid values", async () => {
    chatStore.getState().setTheme({ endOfConversationSurvey: { maxRating: 10 } });
    const ten = await mount<Survey>("end-of-conversation-survey");
    expect($$(ten, ".star")).toHaveLength(10);

    chatStore.getState().setTheme({ endOfConversationSurvey: { maxRating: 0 } });
    const five = await mount<Survey>("end-of-conversation-survey");
    expect($$(five, ".star")).toHaveLength(5);
  });

  it("highlights stars up to the hovered one and clears on mouseleave", async () => {
    const el = await mount<Survey>("end-of-conversation-survey");
    $$(el, ".star")[2].dispatchEvent(new Event("mouseenter"));
    await el.updateComplete;
    expect($$(el, ".star--active")).toHaveLength(3);
    expect($$(el, ".star")[2].classList.contains("star--hovered")).toBe(true);

    $$(el, ".star")[2].dispatchEvent(new Event("mouseleave"));
    await el.updateComplete;
    expect($$(el, ".star--active")).toHaveLength(0);
  });

  it("a high rating can be submitted without a comment", async () => {
    const submitted = listen("survey-submitted");
    const el = await mount<Survey>("end-of-conversation-survey", { messageId: "m-1" });
    await rate(el, 5);
    expect($$(el, ".star")[4].getAttribute("aria-pressed")).toBe("true");
    expect(submitBtn(el).disabled).toBe(false);

    submitBtn(el).click();
    await el.updateComplete;
    expect(submitted).toHaveLength(1);
    expect(submitted[0].detail).toEqual({ rating: 5, comment: "", kind: 1, messageId: "m-1" });
    expect(submitted[0].composed).toBe(true);
  });

  it("a low rating requires a comment before submitting", async () => {
    const submitted = listen("survey-submitted");
    const el = await mount<Survey>("end-of-conversation-survey");
    await rate(el, 2);
    expect(submitBtn(el).disabled).toBe(true);
    expect($(el, ".required-note")!.textContent).toBe("Please tell us what went wrong");
    expect($(el, "textarea")!.getAttribute("aria-invalid")).toBe("true");

    await comment(el, "   ");
    expect(submitBtn(el).disabled).toBe(true);

    await comment(el, "  Too slow  ");
    expect($(el, ".required-note")).toBeNull();
    submitBtn(el).click();
    await el.updateComplete;
    expect(submitted[0].detail).toMatchObject({ rating: 2, comment: "Too slow" });
  });

  it("requireCommentBelow: 0 disables the comment requirement; kind comes from config", async () => {
    chatStore.getState().setTheme({ endOfConversationSurvey: { requireCommentBelow: 0, kind: "agent" } });
    const submitted = listen("survey-submitted");
    const el = await mount<Survey>("end-of-conversation-survey");
    await rate(el, 1);
    expect(submitBtn(el).disabled).toBe(false);
    submitBtn(el).click();
    expect(submitted[0].detail).toMatchObject({ rating: 1, kind: "agent" });
  });

  it("guards submit even if called while invalid", async () => {
    const submitted = listen("survey-submitted");
    const el = await mount<Survey>("end-of-conversation-survey");
    (el as unknown as { _submit(): void })._submit();
    expect(submitted).toHaveLength(0);
  });

  it("switches to the thank-you state after submit, whose close button emits survey-close", async () => {
    const closed = listen("survey-close");
    const el = await mount<Survey>("end-of-conversation-survey", { messageId: "m-2" });
    await rate(el, 4);
    submitBtn(el).click();
    await el.updateComplete;

    expect($(el, ".thanks-title")!.textContent).toBe("We received your feedback!");
    expect($(el, ".stars")).toBeNull();
    $(el, ".close-btn")!.click();
    expect(closed.map((e) => e.detail)).toEqual([{ messageId: "m-2" }]);
  });

  it("skip emits survey-skipped", async () => {
    const skipped = listen("survey-skipped");
    const el = await mount<Survey>("end-of-conversation-survey", { messageId: "m-3" });
    $(el, "button.secondary")!.click();
    expect(skipped.map((e) => e.detail)).toEqual([{ messageId: "m-3" }]);
  });

  it("reflects the overlay property as an attribute", async () => {
    const el = await mount<Survey>("end-of-conversation-survey", { overlay: true });
    expect(el.hasAttribute("overlay")).toBe(true);
  });
});
