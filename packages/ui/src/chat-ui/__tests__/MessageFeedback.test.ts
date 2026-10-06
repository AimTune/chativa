import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../MessageFeedback";
import { $$, mount, resetGlobals, type LitLike } from "../../__tests__/testUtils";

type Feedback = LitLike & {
  messageId: string;
  messageData: Record<string, unknown>;
  active: boolean;
};

let seq = 0;
/** Unique ids — selections persist in a module-level map keyed by message id. */
const nextId = () => `fb-${++seq}-${Date.now()}`;

async function render(props: Partial<Feedback> = {}) {
  return mount<Feedback>("message-feedback", { messageId: nextId(), ...props });
}

function buttons(el: Feedback) {
  const [like, dislike] = $$<HTMLButtonElement>(el, "button");
  return { like, dislike };
}

describe("MessageFeedback", () => {
  let events: CustomEvent[];
  const listener = (e: Event) => events.push(e as CustomEvent);

  beforeEach(() => {
    resetGlobals();
    events = [];
    document.addEventListener("chativa-feedback", listener);
  });

  afterEach(() => {
    document.removeEventListener("chativa-feedback", listener);
    resetGlobals();
  });

  it("renders like / dislike buttons with accessible labels, nothing selected", async () => {
    const el = await render();
    const { like, dislike } = buttons(el);
    expect(like.getAttribute("aria-label")).toBe("Like this message");
    expect(dislike.getAttribute("aria-label")).toBe("Dislike this message");
    expect(like.getAttribute("aria-pressed")).toBe("false");
    expect(dislike.getAttribute("aria-pressed")).toBe("false");
    expect(el.active).toBe(false);
  });

  it("selects a value, reflects `active` and dispatches a composed chativa-feedback event", async () => {
    const el = await render();
    buttons(el).like.click();
    await el.updateComplete;

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ messageId: el.messageId, feedback: "like" });
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
    expect(buttons(el).like.getAttribute("aria-pressed")).toBe("true");
    expect(buttons(el).like.classList.contains("selected-like")).toBe(true);
    expect(el.hasAttribute("active")).toBe(true);
  });

  it("switching from like to dislike dispatches again with the new value", async () => {
    const el = await render();
    buttons(el).like.click();
    await el.updateComplete;
    buttons(el).dislike.click();
    await el.updateComplete;

    expect(events.map((e) => e.detail.feedback)).toEqual(["like", "dislike"]);
    expect(buttons(el).dislike.classList.contains("selected-dislike")).toBe(true);
    expect(buttons(el).like.getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking the selected value again toggles it off without dispatching", async () => {
    const el = await render();
    buttons(el).like.click();
    await el.updateComplete;
    buttons(el).like.click();
    await el.updateComplete;

    expect(events).toHaveLength(1);
    expect(buttons(el).like.getAttribute("aria-pressed")).toBe("false");
    expect(el.active).toBe(false);
  });

  it("persists the local selection per messageId across element instances", async () => {
    const id = nextId();
    const first = await render({ messageId: id });
    buttons(first).dislike.click();
    await first.updateComplete;
    first.remove();

    const second = await render({ messageId: id });
    expect(buttons(second).dislike.getAttribute("aria-pressed")).toBe("true");
    expect(second.active).toBe(true);

    // A different message starts clean.
    const other = await render();
    expect(other.active).toBe(false);
  });

  it("re-reads the stored selection when messageId changes (element reuse)", async () => {
    const idA = nextId();
    const a = await render({ messageId: idA });
    buttons(a).like.click();
    await a.updateComplete;

    a.messageId = nextId();
    await a.updateComplete;
    expect(a.active).toBe(false);

    a.messageId = idA;
    await a.updateComplete;
    expect(buttons(a).like.getAttribute("aria-pressed")).toBe("true");
  });

  it("server-locked feedback (feedbackDisabled) disables buttons and shows feedbackType", async () => {
    const liked = await render({ messageData: { feedbackDisabled: true, feedbackType: 0 } });
    expect(buttons(liked).like.disabled).toBe(true);
    expect(buttons(liked).dislike.disabled).toBe(true);
    expect(buttons(liked).like.getAttribute("aria-pressed")).toBe("true");
    expect(liked.active).toBe(true);

    buttons(liked).dislike.click();
    await liked.updateComplete;
    expect(events).toHaveLength(0);
  });

  it("feedbackDisabled without a feedbackType is locked but shows no selection", async () => {
    const el = await render({ messageData: { feedbackDisabled: true } });
    expect(buttons(el).like.disabled).toBe(true);
    expect(el.active).toBe(false);
    // Even a forced click handler call is ignored.
    (el as unknown as { _onFeedback(v: string): void })._onFeedback("like");
    expect(events).toHaveLength(0);
  });
});
