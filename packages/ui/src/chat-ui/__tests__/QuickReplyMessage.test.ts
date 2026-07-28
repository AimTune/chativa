import { describe, it, expect, vi } from "vitest";

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

import { QuickReplyMessage } from "../QuickReplyMessage";

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

describe("QuickReplyMessage — avatar theming", () => {
  it("uses configured bot avatar URL", () => {
    storeState.theme.avatar = { bot: "https://cdn.example.com/bot-quick.png" };

    const message = new QuickReplyMessage();
    message.sender = "bot";
    message.messageData = {
      text: "Choose",
      actions: [{ label: "Yes", value: "yes" }],
    };

    const rendered = message.render();
    const values = collectTemplateValues(rendered);

    expect(values).toContain("https://cdn.example.com/bot-quick.png");
  });

  it("hides bot avatar when showBot is false", () => {
    storeState.theme.avatar = {
      bot: "https://cdn.example.com/bot-quick.png",
      showBot: false,
    };

    const message = new QuickReplyMessage();
    message.sender = "bot";
    message.messageData = {
      text: "Choose",
      actions: [{ label: "Yes", value: "yes" }],
    };

    const rendered = message.render();
    const values = collectTemplateValues(rendered);

    expect(values).not.toContain("https://cdn.example.com/bot-quick.png");
  });
});
