import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GenUIImageGallery } from "../GenUIImageGallery";
import type { GenUIImage } from "../GenUIImageGallery";

const IMAGES: GenUIImage[] = [
  { src: "https://example.com/a.jpg", alt: "Photo A", caption: "Morning" },
  { src: "https://example.com/b.jpg", alt: "Photo B" },
  { src: "https://example.com/c.jpg", caption: "Evening" },
];

describe("GenUIImageGallery", () => {
  let el: GenUIImageGallery;

  beforeEach(() => {
    el = new GenUIImageGallery();
  });

  it("is defined as a custom element", () => {
    expect(customElements.get("genui-image-gallery")).toBeDefined();
  });

  it("images defaults to undefined", () => {
    expect(el.images).toBeUndefined();
  });

  it("columns defaults to undefined (renders as 2)", () => {
    expect(el.columns).toBeUndefined();
  });

  it("accepts images array", () => {
    el.images = IMAGES;
    expect(el.images).toHaveLength(3);
  });

  it("_open sets _lightboxIndex", () => {
    el.images = IMAGES;
    (el as any)._open(1);
    expect((el as any)._lightboxIndex).toBe(1);
  });

  it("_close sets _lightboxIndex to null", () => {
    el.images = IMAGES;
    (el as any)._open(0);
    (el as any)._close();
    expect((el as any)._lightboxIndex).toBeNull();
  });

  it("_next increments lightboxIndex", () => {
    el.images = IMAGES;
    (el as any)._lightboxIndex = 0;
    (el as any)._next();
    expect((el as any)._lightboxIndex).toBe(1);
  });

  it("_next wraps to 0 from last", () => {
    el.images = IMAGES;
    (el as any)._lightboxIndex = 2;
    (el as any)._next();
    expect((el as any)._lightboxIndex).toBe(0);
  });

  it("_prev decrements lightboxIndex", () => {
    el.images = IMAGES;
    (el as any)._lightboxIndex = 1;
    (el as any)._prev();
    expect((el as any)._lightboxIndex).toBe(0);
  });

  it("_prev wraps to last from 0", () => {
    el.images = IMAGES;
    (el as any)._lightboxIndex = 0;
    (el as any)._prev();
    expect((el as any)._lightboxIndex).toBe(2);
  });

  it("_onKeydown Escape closes lightbox", () => {
    el.images = IMAGES;
    (el as any)._lightboxIndex = 1;
    el._onKeydown(new KeyboardEvent("keydown", { key: "Escape" }));
    expect((el as any)._lightboxIndex).toBeNull();
  });

  it("_onKeydown ArrowRight calls _next", () => {
    el.images = IMAGES;
    (el as any)._lightboxIndex = 0;
    el._onKeydown(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect((el as any)._lightboxIndex).toBe(1);
  });

  it("_onKeydown ArrowLeft calls _prev", () => {
    el.images = IMAGES;
    (el as any)._lightboxIndex = 1;
    el._onKeydown(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect((el as any)._lightboxIndex).toBe(0);
  });

  it("_onKeydown does nothing when lightbox is closed", () => {
    el.images = IMAGES;
    (el as any)._lightboxIndex = null;
    expect(() => el._onKeydown(new KeyboardEvent("keydown", { key: "Escape" }))).not.toThrow();
    expect((el as any)._lightboxIndex).toBeNull();
  });

  it("render does not throw with empty images", () => {
    el.images = [];
    expect(() => (el as any).render()).not.toThrow();
  });

  it("render does not throw with images set", () => {
    el.images = IMAGES;
    el.columns = 3;
    expect(() => (el as any).render()).not.toThrow();
  });
});

describe("GenUIImageGallery (mounted)", () => {
  let el: GenUIImageGallery;
  const root = () => el.shadowRoot!;
  const lightboxImg = () => root().querySelector<HTMLImageElement>(".lightbox-img");

  beforeEach(async () => {
    el = new GenUIImageGallery();
    el.images = IMAGES;
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders a thumbnail per image with accessible labels and captions", () => {
    const thumbs = root().querySelectorAll(".thumb");
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0]!.getAttribute("aria-label")).toBe("Photo A");
    expect(thumbs[2]!.getAttribute("aria-label")).toBe("Evening");
    expect(Array.from(root().querySelectorAll(".caption")).map((c) => c.textContent)).toEqual([
      "Morning",
      "Evening",
    ]);
  });

  it("opens the lightbox on thumbnail click and closes via the close button", async () => {
    root().querySelectorAll<HTMLElement>(".thumb")[1]!.click();
    await el.updateComplete;
    expect(root().querySelector('[role="dialog"]')).not.toBeNull();
    expect(lightboxImg()!.getAttribute("src")).toBe(IMAGES[1]!.src);
    expect(root().querySelector(".lightbox-caption")).toBeNull();

    root().querySelector<HTMLButtonElement>(".lightbox-close")!.click();
    await el.updateComplete;
    expect(root().querySelector('[role="dialog"]')).toBeNull();
  });

  it("opens the lightbox from the keyboard with Enter or Space", async () => {
    const thumb = root().querySelectorAll<HTMLElement>(".thumb")[0]!;
    thumb.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    await el.updateComplete;
    expect(root().querySelector(".lightbox-caption")?.textContent).toBe("Morning");

    (el as any)._close();
    await el.updateComplete;
    thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    await el.updateComplete;
    expect(root().querySelector(".lightbox")).toBeNull();

    thumb.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await el.updateComplete;
    expect(root().querySelector(".lightbox")).not.toBeNull();
  });

  it("navigates with the prev/next buttons and window arrow keys", async () => {
    root().querySelectorAll<HTMLElement>(".thumb")[0]!.click();
    await el.updateComplete;

    root().querySelector<HTMLButtonElement>(".lightbox-nav.next")!.click();
    await el.updateComplete;
    expect(lightboxImg()!.getAttribute("src")).toBe(IMAGES[1]!.src);

    root().querySelector<HTMLButtonElement>(".lightbox-nav.prev")!.click();
    await el.updateComplete;
    expect(lightboxImg()!.getAttribute("src")).toBe(IMAGES[0]!.src);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    await el.updateComplete;
    expect(lightboxImg()!.getAttribute("src")).toBe(IMAGES[2]!.src);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await el.updateComplete;
    expect(root().querySelector(".lightbox")).toBeNull();
  });

  it("closes on a backdrop click but not on a click inside the lightbox", async () => {
    root().querySelectorAll<HTMLElement>(".thumb")[0]!.click();
    await el.updateComplete;

    lightboxImg()!.click();
    await el.updateComplete;
    expect(root().querySelector(".lightbox")).not.toBeNull();

    root().querySelector<HTMLElement>(".lightbox")!.click();
    await el.updateComplete;
    expect(root().querySelector(".lightbox")).toBeNull();
  });

  it("hides navigation for a single image", async () => {
    el.images = [IMAGES[0]!];
    await el.updateComplete;
    root().querySelector<HTMLElement>(".thumb")!.click();
    await el.updateComplete;
    expect(root().querySelector(".lightbox-nav")).toBeNull();
  });

  it("stops listening to window keys once disconnected", async () => {
    root().querySelectorAll<HTMLElement>(".thumb")[0]!.click();
    await el.updateComplete;
    el.remove();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect((el as any)._lightboxIndex).toBe(0);
  });

  it("ignores prev/next when the lightbox is closed", () => {
    (el as any)._prev();
    (el as any)._next();
    expect((el as any)._lightboxIndex).toBeNull();
  });
});
