import * as React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { ChatBotButton } from "../ChatBotButton";

afterEach(() => {
  cleanup();
});

/** First mount pays for the dynamic `import("@chativa/ui")`; see ChatIva.test. */
function waitForButton(container: HTMLElement) {
  return waitFor(() => {
    expect(container.querySelector("chat-bot-button")).not.toBeNull();
  }, { timeout: 15000 });
}

describe("ChatBotButton", () => {
  it("renders nothing synchronously (SSR-safe)", () => {
    const { container } = render(<ChatBotButton />);
    expect(container.querySelector("chat-bot-button")).toBeNull();
  });

  it("lazily mounts the underlying <chat-bot-button> custom element", async () => {
    const { container } = render(<ChatBotButton />);
    await waitForButton(container);

    const el = container.querySelector("chat-bot-button")!;
    expect(el).toBeInstanceOf(customElements.get("chat-bot-button")!);
  });

  it("forwards className, style and the ref to the element", async () => {
    const ref = React.createRef<HTMLElement>();
    const { container } = render(
      <ChatBotButton ref={ref} className="launcher" style={{ zIndex: 7 }} />,
    );
    await waitForButton(container);

    const el = container.querySelector<HTMLElement>("chat-bot-button")!;
    expect(el.classList.contains("launcher")).toBe(true);
    expect(el.style.zIndex).toBe("7");
    await waitFor(() => expect(ref.current).toBe(el));
  });

  it("renders children into the element's light DOM (default slot)", async () => {
    const { container } = render(
      <ChatBotButton>
        <span className="custom-icon">?</span>
      </ChatBotButton>,
    );
    await waitForButton(container);

    const el = container.querySelector("chat-bot-button")!;
    expect(el.querySelector(".custom-icon")?.textContent).toBe("?");
  });
});
