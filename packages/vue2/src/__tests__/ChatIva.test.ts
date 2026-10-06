import { describe, it, expect, afterEach } from "vitest";
import { mount, type Wrapper } from "@vue/test-utils";
import type Vue from "vue";
import {
  EventBus,
  ConnectorRegistry,
  chatStore,
  type IncomingMessage,
} from "@chativa/core";
import { ChatIva } from "../ChatIva";
import { attachPoint, makeFakeConnector, mountable, waitFor } from "./helpers";

let wrapper: Wrapper<Vue> | null = null;

afterEach(() => {
  wrapper?.destroy();
  wrapper = null;
  document.body.innerHTML = "";
});

function mountChatIva(options: Record<string, unknown> = {}) {
  wrapper = mount(mountable(ChatIva), { attachTo: attachPoint(), ...options });
  return wrapper;
}

const waitForWidget = () =>
  waitFor(() => {
    expect(document.querySelector("chat-iva")).not.toBeNull();
  });

describe("ChatIva", () => {
  it("renders nothing synchronously (SSR-safe: the UI bundle loads in mounted())", () => {
    const w = mountChatIva({ propsData: { connector: makeFakeConnector("vue2-chativa-1") } });
    expect(w.element.nodeType).toBe(Node.COMMENT_NODE);
    expect(document.querySelector("chat-iva")).toBeNull();
  });

  it("lazily renders <chat-iva>, auto-registers the connector instance and activates it", async () => {
    const w = mountChatIva({ propsData: { connector: makeFakeConnector("vue2-chativa-2") } });
    await waitForWidget();

    expect(ConnectorRegistry.has("vue2-chativa-2")).toBe(true);
    expect(chatStore.getState().activeConnector).toBe("vue2-chativa-2");
    // Forwarded as a DOM property, not an attribute.
    const el = w.element as HTMLElement & { connector: string };
    expect(el.tagName.toLowerCase()).toBe("chat-iva");
    expect(el.connector).toBe("vue2-chativa-2");
  });

  it("accepts a registered connector name string", async () => {
    ConnectorRegistry.register(makeFakeConnector("vue2-chativa-3"));
    mountChatIva({ propsData: { connector: "vue2-chativa-3" } });
    await waitForWidget();
    expect(chatStore.getState().activeConnector).toBe("vue2-chativa-3");
    ConnectorRegistry.unregister("vue2-chativa-3");
  });

  it("does not touch the active connector when no connector prop is given", async () => {
    ConnectorRegistry.register(makeFakeConnector("vue2-untouched"));
    chatStore.getState().setConnector("vue2-untouched");
    const w = mountChatIva();
    await waitForWidget();
    expect(chatStore.getState().activeConnector).toBe("vue2-untouched");
    expect((w.element as HTMLElement & { connector: string }).connector).toBe("dummy");
  });

  it("re-applies the connector when the prop changes", async () => {
    const w = mountChatIva({ propsData: { connector: makeFakeConnector("vue2-chativa-4a") } });
    await waitForWidget();
    await w.setProps({ connector: makeFakeConnector("vue2-chativa-4b") });
    expect(chatStore.getState().activeConnector).toBe("vue2-chativa-4b");
    expect((w.element as HTMLElement & { connector: string }).connector).toBe("vue2-chativa-4b");
  });

  it("applies fullscreenOnly before the element connects, and treats false as no opinion", () => {
    chatStore.getState().setFullscreen(false);
    chatStore.getState().setAllowFullscreen(true);

    mountChatIva({ propsData: { connector: makeFakeConnector("vue2-fs-1"), fullscreenOnly: false } });
    expect(chatStore.getState().isFullscreen).toBe(false);
    expect(chatStore.getState().allowFullscreen).toBe(true);
    wrapper?.destroy();

    mountChatIva({ propsData: { connector: makeFakeConnector("vue2-fs-2"), fullscreenOnly: true } });
    expect(chatStore.getState().isFullscreen).toBe(true);
    expect(chatStore.getState().allowFullscreen).toBe(false);

    chatStore.getState().setFullscreen(false);
    chatStore.getState().setAllowFullscreen(true);
  });

  it("re-emits EventBus events as Vue events", async () => {
    const w = mountChatIva({ propsData: { connector: makeFakeConnector("vue2-chativa-5") } });
    await waitForWidget();

    const message: IncomingMessage = { id: "m1", type: "text", data: { text: "hi" }, timestamp: 1 };
    const sent = { id: "s1", type: "text", data: { text: "yo" }, timestamp: 2 };
    const survey = { rating: 5 } as never;
    EventBus.emit("message_received", message);
    EventBus.emit("message_sent", sent);
    EventBus.emit("survey_submitted", survey);
    EventBus.emit("widget_opened", undefined);
    EventBus.emit("widget_closed", undefined);
    EventBus.emit("connector_status_changed", { status: "connected" });
    EventBus.emit("connector_status_changed", { status: "connecting" });
    EventBus.emit("connector_status_changed", { status: "error" });

    expect(w.emitted("message")?.[0]).toEqual([message]);
    expect(w.emitted("message-sent")?.[0]).toEqual([sent]);
    expect(w.emitted("survey-submit")?.[0]).toEqual([survey]);
    expect(w.emitted("widget-open")).toHaveLength(1);
    expect(w.emitted("widget-close")).toHaveLength(1);
    expect(w.emitted("connect")).toHaveLength(1);
    expect(w.emitted("disconnect")).toEqual([[{ status: "error" }]]);
  });

  it("stops listening to the EventBus once destroyed", async () => {
    const w = mountChatIva({ propsData: { connector: makeFakeConnector("vue2-chativa-6") } });
    await waitForWidget();
    w.destroy();
    EventBus.emit("widget_opened", undefined);
    expect(w.emitted("widget-open")).toBeUndefined();
    wrapper = null;
  });

  it("re-emits the element's chativa-feedback / chativa-reset CustomEvents", async () => {
    const w = mountChatIva({ propsData: { connector: makeFakeConnector("vue2-chativa-7") } });
    await waitForWidget();

    const detail = { messageId: "m1", feedback: "like" };
    // `<chat-iva>` forwards feedback to its engine — keep that from failing the test.
    w.element.dispatchEvent(new CustomEvent("chativa-feedback", { detail }));
    w.element.dispatchEvent(new CustomEvent("chativa-reset", { bubbles: true, composed: true }));

    expect(w.emitted("feedback")?.[0]).toEqual([detail]);
    expect(w.emitted("reset")).toHaveLength(1);
  });

  it("passes default-slot content through to the element", async () => {
    const w = mountChatIva({
      propsData: { connector: makeFakeConnector("vue2-chativa-8") },
      slots: { default: '<span class="slotted">hello</span>' },
    });
    await waitForWidget();
    expect(w.element.querySelector(".slotted")?.textContent).toBe("hello");
  });

  it("round-trips a bot message from the connector to a @message listener", async () => {
    const connector = makeFakeConnector("vue2-chativa-roundtrip");
    const w = mountChatIva({ propsData: { connector } });
    await waitForWidget();

    chatStore.getState().open();
    await waitFor(() => expect(w.emitted("connect")).toBeTruthy());

    connector.push("hello from the bot");
    await waitFor(() => expect(w.emitted("message")).toBeTruthy());
    const [received] = w.emitted("message")![0] as [IncomingMessage];
    expect(received.data).toEqual({ text: "hello from the bot" });

    chatStore.getState().close();
  });
});
