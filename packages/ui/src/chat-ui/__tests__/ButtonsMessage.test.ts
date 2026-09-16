import { describe, it, expect, vi } from "vitest";
import { marked } from "marked";

const { getStateMock, storeState } = vi.hoisted(() => {
  const storeState: { theme: { avatar?: { bot?: string; showBot?: boolean } } } = {
    theme: {},
  };
  return {
    getStateMock: vi.fn(() => storeState),
    storeState,
  };
});

vi.mock("@chativa/core", () => ({
  MessageTypeRegistry: { register: vi.fn() },
  chatStore: { getState: getStateMock },
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

import { ButtonsMessage } from "../ButtonsMessage";

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

describe("ButtonsMessage — body markdown rendering", () => {
  it("renders links and separate paragraphs in the message bubble", () => {
    const message = new ButtonsMessage();
    message.sender = "bot";
    message.messageData = {
      text: "Read [here](https://example.com).\n\nAre you a customer?",
      buttons: [{ label: "Yes" }],
    };

    const rendered = message.render();
    const values = collectTemplateValues(rendered);
    const bodyHtml = values.find((value) => value.includes("https://example.com"));

    expect(bodyHtml).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">here</a>',
    );
    expect(bodyHtml).toContain("</p>\n<p>Are you a customer?</p>");
  });
});

function collectTemplateValues(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") {
    out.push(node);
    return out;
  }
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((n) => collectTemplateValues(n, out));
    return out;
  }

  const maybeTemplate = node as { vals?: unknown[] };
  if (Array.isArray(maybeTemplate.vals)) {
    collectTemplateValues(maybeTemplate.vals, out);
  }

  Object.values(node).forEach((value) => collectTemplateValues(value, out));
  return out;
}

describe("ButtonsMessage — avatar theming", () => {
  it("uses configured bot avatar URL", () => {
    storeState.theme.avatar = { bot: "https://cdn.example.com/bot.png" };

    const message = new ButtonsMessage();
    message.sender = "bot";
    message.messageData = { text: "Hi", buttons: [{ label: "A" }] };

    const rendered = message.render();
    const values = collectTemplateValues(rendered);

    expect(values).toContain("https://cdn.example.com/bot.png");
  });

  it("hides bot avatar when showBot is false", () => {
    storeState.theme.avatar = {
      bot: "https://cdn.example.com/bot.png",
      showBot: false,
    };

    const message = new ButtonsMessage();
    message.sender = "bot";
    message.messageData = { text: "Hi", buttons: [{ label: "A" }] };

    const rendered = message.render();
    const values = collectTemplateValues(rendered);

    expect(values).not.toContain("https://cdn.example.com/bot.png");
  });
});
