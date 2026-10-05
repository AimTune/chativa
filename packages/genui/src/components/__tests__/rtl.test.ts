import { describe, it, expect, afterEach } from "vitest";
import { bubbleStyles } from "../../styles/bubble";
import { GenUIImageGallery } from "../GenUIImageGallery";
import "../GenUIRating";
import "../GenUIChart";
import "../GenUISteps";
import "../GenUIAlert";
import "../GenUIMessage";

/**
 * RTL invariants for the built-in GenUI components (issue #11).
 *
 * jsdom does no layout, so these check the stylesheets and the
 * direction-aware behaviour rather than rendered positions.
 */

function cssOf(tag: string): string {
  const ctor = customElements.get(tag) as unknown as { elementStyles?: Array<{ cssText?: string }> };
  return (ctor.elementStyles ?? []).map((s) => s.cssText ?? "").join("\n");
}

describe("GenUI — RTL", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("bubbleStyles puts the tail on the logical start corner and isolates bidi per line", () => {
    const css = bubbleStyles.cssText;
    expect(css).toMatch(/border-start-start-radius:\s*4px/);
    expect(css).not.toMatch(/border-radius:\s*4px 16px/);
    expect(css).toMatch(/unicode-bidi:\s*plaintext/);
  });

  it("uses logical properties for the alert accent, step connector and message gutter", () => {
    expect(cssOf("genui-alert")).toMatch(/border-inline-start:\s*4px solid/);
    expect(cssOf("genui-steps")).toMatch(/inset-inline-start:\s*11px/);
    expect(cssOf("genui-message")).toMatch(/margin-inline-end:\s*auto/);
    expect(cssOf("genui-image-gallery")).toMatch(/\.lightbox-nav\.prev\s*\{\s*inset-inline-start:\s*16px/);
  });

  it("keeps rating stars and the bar-chart axis left-to-right", () => {
    expect(cssOf("genui-rating")).toMatch(/\.stars\s*\{[^}]*direction:\s*ltr/);
    expect(cssOf("genui-chart")).toMatch(/\.bar-chart\s*\{[^}]*direction:\s*ltr/);
  });

  it("image gallery arrow keys follow the visual order under RTL", () => {
    const el = new GenUIImageGallery();
    el.images = [{ src: "a.jpg" }, { src: "b.jpg" }, { src: "c.jpg" }];
    el.style.direction = "rtl";
    document.body.appendChild(el);
    const idx = () => (el as unknown as { _lightboxIndex: number | null })._lightboxIndex;
    (el as unknown as { _lightboxIndex: number })._lightboxIndex = 1;

    el._onKeydown(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(idx()).toBe(2); // left = next in RTL

    el._onKeydown(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(idx()).toBe(1); // right = previous in RTL
  });
});
