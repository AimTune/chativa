import { describe, it, expect, vi } from "vitest";
import { marked } from "marked";

vi.mock("@chativa/core", () => ({
  MessageTypeRegistry: { register: vi.fn() },
  chatStore: { getState: () => ({ theme: {} }) },
}));
vi.mock("lit", () => ({
  LitElement: class {},
  html: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }),
  css: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }),
  nothing: null,
}));
vi.mock("lit/decorators.js", () => ({
  customElement: () => () => {},
  property: () => () => {},
  state: () => () => {},
}));
vi.mock("lit/directives/unsafe-html.js", () => ({
  unsafeHTML: (html: string) => html,
}));

/** Mirrors the renderInlineMarkdown helper in ButtonsMessage.ts */
function renderInlineMarkdown(text: string): string {
  return (marked.parse(text, { async: false }) as string).replace(/^<p>(.*)<\/p>\n?$/s, "$1");
}

describe("ButtonsMessage — label markdown rendering", () => {
  it("renders bold label", () => {
    expect(renderInlineMarkdown("**Track order**")).toContain("<strong>Track order</strong>");
  });

  it("renders italic label", () => {
    expect(renderInlineMarkdown("_Return_")).toContain("<em>Return</em>");
  });

  it("renders plain label unchanged", () => {
    expect(renderInlineMarkdown("Agent")).toContain("Agent");
  });

  it("strips wrapping <p> tag for inline content", () => {
    const result = renderInlineMarkdown("**bold**");
    expect(result.startsWith("<p>")).toBe(false);
  });
});
