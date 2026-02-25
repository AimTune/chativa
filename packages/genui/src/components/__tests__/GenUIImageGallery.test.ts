import { describe, it, expect, beforeEach } from "vitest";
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
