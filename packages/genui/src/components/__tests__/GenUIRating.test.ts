import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { i18next } from "@chativa/core";
import { GenUIRating } from "../GenUIRating";

beforeAll(async () => {
  await i18next.init({ lng: "en", resources: {} });
});

afterEach(() => {
  document.body.innerHTML = "";
});

async function mount(props: Partial<Pick<GenUIRating, "title" | "maxStars" | "readonly" | "value">> = {}) {
  const el = new GenUIRating();
  const sendEvent = vi.fn();
  el.sendEvent = sendEvent;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  const root = el.shadowRoot!;
  const stars = () => Array.from(root.querySelectorAll<HTMLButtonElement>(".star"));
  const submitBtn = () => root.querySelector<HTMLButtonElement>(".submit-btn");
  const activeCount = () => stars().filter((s) => s.classList.contains("star--active")).length;
  return { el, root, sendEvent, stars, submitBtn, activeCount };
}

describe("GenUIRating", () => {
  it("is defined as a custom element", () => {
    expect(customElements.get("genui-rating")).toBe(GenUIRating);
  });

  it("renders maxStars star buttons with i18n aria labels", async () => {
    const { root, stars } = await mount({ maxStars: 3, title: "How did we do?" });

    expect(stars()).toHaveLength(3);
    expect(stars()[2]!.getAttribute("aria-label")).toBe("3 star");
    expect(root.querySelector(".stars")?.getAttribute("aria-label")).toBe("Star rating");
    expect(root.querySelector(".rating-title")?.textContent).toBe("How did we do?");
  });

  it("defaults to five stars and no title", async () => {
    const { root, stars } = await mount();
    expect(stars()).toHaveLength(5);
    expect(root.querySelector(".rating-title")).toBeNull();
  });

  it("keeps the submit button disabled until a star is selected", async () => {
    const { el, stars, submitBtn, activeCount } = await mount();
    expect(submitBtn()!.disabled).toBe(true);
    expect(submitBtn()!.textContent).toBe("Submit");

    stars()[3]!.click();
    await el.updateComplete;

    expect(activeCount()).toBe(4);
    expect(submitBtn()!.disabled).toBe(false);
  });

  it("emits rating_submit with the selected rating and shows the thank-you note", async () => {
    const { el, root, stars, submitBtn, sendEvent } = await mount();
    stars()[1]!.click();
    await el.updateComplete;

    submitBtn()!.click();
    await el.updateComplete;

    expect(sendEvent).toHaveBeenCalledWith("rating_submit", { rating: 2 });
    expect(root.querySelector(".thank-you")?.textContent).toBe("Thank you for your feedback!");
    expect(submitBtn()).toBeNull();
    stars().forEach((s) => expect(s.disabled).toBe(true));
  });

  it("ignores star clicks and repeat submits once submitted", async () => {
    const { el, stars, submitBtn, sendEvent, activeCount } = await mount();
    stars()[0]!.click();
    await el.updateComplete;
    submitBtn()!.click();
    await el.updateComplete;

    const internals = el as unknown as { _onStarClick(n: number): void; _onSubmit(): void };
    internals._onStarClick(5);
    internals._onSubmit();
    await el.updateComplete;

    expect(activeCount()).toBe(1);
    expect(sendEvent).toHaveBeenCalledOnce();
  });

  it("does not submit when nothing is selected", async () => {
    const { el, sendEvent } = await mount();
    (el as unknown as { _onSubmit(): void })._onSubmit();
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it("pre-selects the initial value on connect", async () => {
    const { activeCount, submitBtn } = await mount({ value: 3 });
    expect(activeCount()).toBe(3);
    expect(submitBtn()!.disabled).toBe(false);
  });

  it("renders read-only: disabled stars, no submit button, clicks ignored", async () => {
    const { el, stars, submitBtn, activeCount } = await mount({ readonly: true, value: 2 });

    expect(submitBtn()).toBeNull();
    stars().forEach((s) => expect(s.disabled).toBe(true));

    (el as unknown as { _onStarClick(n: number): void })._onStarClick(5);
    await el.updateComplete;
    expect(activeCount()).toBe(2);
  });

  it("previews the hovered star and clears the preview on mouseleave", async () => {
    const { el, stars, activeCount } = await mount();

    stars()[2]!.dispatchEvent(new Event("mouseenter"));
    await el.updateComplete;
    expect(activeCount()).toBe(3);
    expect(stars()[2]!.classList.contains("star--hovered")).toBe(true);

    stars()[2]!.dispatchEvent(new Event("mouseleave"));
    await el.updateComplete;
    expect(activeCount()).toBe(0);
  });

  it("does not hover-preview when read-only", async () => {
    const { el, stars, activeCount } = await mount({ readonly: true });
    stars()[2]!.dispatchEvent(new Event("mouseenter"));
    await el.updateComplete;
    expect(activeCount()).toBe(0);
  });
});
