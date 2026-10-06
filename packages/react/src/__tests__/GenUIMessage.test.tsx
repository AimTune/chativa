import * as React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { GenUIMessage } from "../GenUIMessage";

afterEach(() => {
  cleanup();
});

type GenUIEl = HTMLElement & {
  messageData: Record<string, unknown>;
  messageId: string;
  sender: string;
  hideAvatar: boolean;
  debug: boolean;
  updateComplete: Promise<boolean>;
};

function waitForElement(container: HTMLElement) {
  return waitFor(() => {
    expect(container.querySelector("genui-message")).not.toBeNull();
  }, { timeout: 15000 });
}

describe("GenUIMessage (React)", () => {
  it("renders nothing synchronously (SSR-safe)", () => {
    const { container } = render(<GenUIMessage />);
    expect(container.querySelector("genui-message")).toBeNull();
  });

  it("maps React props onto <genui-message> element properties", async () => {
    const messageData = {
      chunks: [{ type: "text", content: "Hello from React", id: 1 }],
      streamingComplete: true,
    };
    const { container } = render(
      <GenUIMessage messageData={messageData} messageId="m-1" sender="bot" hideAvatar debug />,
    );
    await waitForElement(container);

    const el = container.querySelector("genui-message") as GenUIEl;
    await waitFor(() => expect(el.messageData).toBe(messageData));
    expect(el.messageId).toBe("m-1");
    expect(el.sender).toBe("bot");
    expect(el.hideAvatar).toBe(true);
    expect(el.debug).toBe(true);

    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".chativa-bubble")?.textContent).toBe("Hello from React");
  });

  it("pushes updated messageData into the same element as the stream grows", async () => {
    const first = { chunks: [{ type: "text", content: "one", id: 1 }], streamingComplete: false };
    const second = {
      chunks: [
        { type: "text", content: "one", id: 1 },
        { type: "text", content: "two", id: 2 },
      ],
      streamingComplete: true,
    };
    const { container, rerender } = render(<GenUIMessage messageData={first} />);
    await waitForElement(container);
    const el = container.querySelector("genui-message") as GenUIEl;

    rerender(<GenUIMessage messageData={second} />);
    await waitFor(() => expect(el.messageData).toBe(second));
    await el.updateComplete;

    expect(container.querySelector("genui-message")).toBe(el);
    expect(el.shadowRoot!.querySelectorAll(".chativa-bubble")).toHaveLength(2);
  });

  it("forwards the ref, and genui-send-event from embedded components still bubbles", async () => {
    const ref = React.createRef<HTMLElement>();
    const messageData = {
      chunks: [
        { type: "ui", component: "html", props: { html: `<button data-event="go">Go</button>` }, id: 9 },
      ],
      streamingComplete: true,
    };
    const { container } = render(<GenUIMessage ref={ref} messageData={messageData} messageId="m-2" />);
    await waitForElement(container);
    const el = container.querySelector("genui-message") as GenUIEl;
    await waitFor(() => expect(ref.current).toBe(el));
    await waitFor(() => expect(el.messageData).toBe(messageData));
    await el.updateComplete;

    const html = el.shadowRoot!.querySelector("chativa-html") as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await html.updateComplete;
    const spy = vi.fn();
    document.addEventListener("genui-send-event", spy as EventListener);
    html.shadowRoot!.querySelector("button")!.click();
    document.removeEventListener("genui-send-event", spy as EventListener);

    expect((spy.mock.calls[0]![0] as CustomEvent).detail).toMatchObject({
      msgId: "m-2",
      eventType: "go",
      sourceId: 9,
    });
  });
});
