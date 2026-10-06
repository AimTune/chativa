import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/svelte";
import GenUIMessage from "../GenUIMessage.svelte";
import { waitForElement } from "./helpers";

type GenUIMessageElement = HTMLElement & {
  messageData: Record<string, unknown>;
  sender: string;
  messageId: string;
  timestamp: number;
  hideAvatar: boolean;
  status: string;
  debug: boolean;
};

describe("GenUIMessage", () => {
  it("lazily mounts <genui-message> and assigns the props as element properties", async () => {
    const messageData = { chunks: [], streamingComplete: true };
    let bound: HTMLElement | null = null;

    const { container } = render(GenUIMessage, {
      messageData,
      sender: "user",
      messageId: "g1",
      timestamp: 42,
      hideAvatar: true,
      status: "read",
      debug: true,
      class: "reply",
      style: "display: block",
      get element() {
        return bound;
      },
      set element(v) {
        bound = v ?? null;
      },
    });
    expect(container.querySelector("genui-message")).toBeNull();

    const el = (await waitForElement("genui-message")) as GenUIMessageElement;
    // Properties are assigned by an effect that runs right after insertion.
    await vi.waitFor(() => expect(el.messageId).toBe("g1"));
    expect(el.messageData).toEqual(messageData);
    expect(el.sender).toBe("user");
    expect(el.messageId).toBe("g1");
    expect(el.timestamp).toBe(42);
    expect(el.hideAvatar).toBe(true);
    expect(el.status).toBe("read");
    expect(el.debug).toBe(true);
    expect(el.classList.contains("reply")).toBe(true);
    expect(bound).toBe(el);
  });

  it("leaves the element's own defaults alone for props that were not passed", async () => {
    render(GenUIMessage);
    const el = (await waitForElement("genui-message")) as GenUIMessageElement;
    expect(el.sender).toBe("bot");
    expect(el.status).toBe("sent");
    expect(el.debug).toBe(false);
  });

  it("does not mount the element if unmounted before @chativa/genui resolves", async () => {
    const { unmount } = render(GenUIMessage);
    unmount();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector("genui-message")).toBeNull();
  });
});
