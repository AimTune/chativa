import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import ChatBotButton from "../ChatBotButton.svelte";
import { waitForElement } from "./helpers";

describe("ChatBotButton", () => {
  it("renders nothing synchronously, then lazily mounts <chat-bot-button>", async () => {
    const { container } = render(ChatBotButton);
    expect(container.querySelector("chat-bot-button")).toBeNull();

    await waitForElement("chat-bot-button");
    expect(customElements.get("chat-bot-button")).toBeDefined();
  });

  it("slots custom launcher content and forwards class / style / element", async () => {
    const children = createRawSnippet(() => ({
      render: () => `<button class="custom-launcher">Ask</button>`,
    }));
    let bound: HTMLElement | null = null;

    render(ChatBotButton, {
      class: "launcher-host",
      style: "z-index: 1",
      children,
      get element() {
        return bound;
      },
      set element(v) {
        bound = v ?? null;
      },
    });

    const el = await waitForElement("chat-bot-button");
    expect(el.classList.contains("launcher-host")).toBe(true);
    expect(el.getAttribute("style")).toContain("z-index");
    expect(el.querySelector(".custom-launcher")?.textContent).toBe("Ask");
    expect(bound).toBe(el);
  });

  it("does not mount the element if unmounted before @chativa/ui resolves", async () => {
    const { unmount } = render(ChatBotButton);
    unmount();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector("chat-bot-button")).toBeNull();
  });
});
