import { describe, it, expect, vi } from "vitest";
import type { GenUIStreamState } from "@chativa/core";
import { GenUIHtmlElement } from "@chativa/core";
import { GenUIRegistry } from "../../registry/GenUIRegistry";
import "../../index";

/**
 * End-to-end path for backend-authored components: a connector streams a
 * `{ type: "ui", component: "html" }` chunk, `GenUIMessage` mounts
 * `<chativa-html>`, and a `data-event` click travels back out as
 * `genui-send-event` (which ChatWidget forwards to
 * `IConnector.receiveComponentEvent`).
 */

const streamState = (html: string): GenUIStreamState => ({
  chunks: [{ type: "ui", component: "html", props: { html }, id: 1 }],
  streamingComplete: true,
});

async function mountMessage(state: GenUIStreamState) {
  const el = document.createElement("genui-message") as HTMLElement & {
    messageData: unknown;
    messageId: string;
    updateComplete: Promise<boolean>;
  };
  el.messageId = "msg-1";
  el.messageData = state;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const mountedHtmlElement = (msg: HTMLElement): GenUIHtmlElement =>
  msg.shadowRoot!.querySelector("chativa-html") as GenUIHtmlElement;

describe("backend-authored HTML chunk", () => {
  it("registers the raw-markup component under both names", () => {
    expect(GenUIRegistry.resolve("html")?.component).toBe(GenUIHtmlElement);
    expect(GenUIRegistry.resolve("genui-html")?.component).toBe(GenUIHtmlElement);
  });

  it("mounts <chativa-html> and renders the streamed markup", async () => {
    const msg = await mountMessage(streamState(`<p class="from-backend">Order #123</p>`));
    const el = mountedHtmlElement(msg);

    expect(el).not.toBeNull();
    await el.updateComplete;
    expect(el.shadowRoot!.innerHTML).toContain("Order #123");

    msg.remove();
  });

  it("routes a data-event click back out as genui-send-event", async () => {
    const msg = await mountMessage(
      streamState(`<button data-event="track_order" data-payload='{"id":123}'>Track</button>`)
    );
    const el = mountedHtmlElement(msg);
    await el.updateComplete;

    const spy = vi.fn();
    document.body.addEventListener("genui-send-event", spy as EventListener);
    el.shadowRoot!.querySelector("button")!.click();

    expect(spy).toHaveBeenCalledOnce();
    const detail = (spy.mock.calls[0]![0] as CustomEvent).detail;
    expect(detail).toMatchObject({
      msgId: "msg-1",
      eventType: "track_order",
      payload: { id: 123 },
      sourceId: 1,
    });

    document.body.removeEventListener("genui-send-event", spy as EventListener);
    msg.remove();
  });

  it("updates the same instance when the backend streams new markup", async () => {
    const msg = await mountMessage(streamState("<p>step one</p>")) as HTMLElement & {
      messageData: unknown;
      updateComplete: Promise<boolean>;
    };
    const first = mountedHtmlElement(msg);

    msg.messageData = streamState("<p>step two</p>");
    await msg.updateComplete;
    const second = mountedHtmlElement(msg);
    await second.updateComplete;

    // Same element instance (keyed by chunk id), new content.
    expect(second).toBe(first);
    expect(second.shadowRoot!.innerHTML).toContain("step two");
    expect(second.shadowRoot!.innerHTML).not.toContain("step one");

    msg.remove();
  });
});
