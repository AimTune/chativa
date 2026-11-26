import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../markdown";

describe("renderMarkdown", () => {
  it("preserves numeric asterisks inside Markdown emphasis", () => {
    const html = renderMarkdown("- **8x2*6 / 8x4*4:**");

    expect(html).toContain("<strong>8x2*6 / 8x4*4:</strong>");
    expect(html).not.toContain("<em>");
  });

  it("preserves code spans and normal emphasis", () => {
    const html = renderMarkdown("`8x4*4` **bold** *italic*");
    const fencedHtml = renderMarkdown("```\n8x2*6\n```");

    expect(html).toContain("<code>8x4*4</code>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(fencedHtml).toContain("<code>8x2*6\n</code>");
  });
});
