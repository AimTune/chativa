import { describe, it, expect, afterEach } from "vitest";
import { mount, enableAutoUnmount } from "@vue/test-utils";
import { h, nextTick, ref } from "vue";
import {
  EventBus,
  ConnectorRegistry,
  chatStore,
  type IncomingMessage,
} from "@chativa/core";
import { ChatIva } from "../ChatIva";
import { makeFakeConnector, waitForElement } from "./helpers";

enableAutoUnmount(afterEach);

describe("ChatIva", () => {
  it("renders nothing synchronously (SSR-safe: no element before mount resolves)", () => {
    const wrapper = mount(ChatIva, {
      props: { connector: makeFakeConnector("vue-chativa-connector-1") },
      attachTo: document.body,
    });
    expect(wrapper.find("chat-iva").exists()).toBe(false);
  });

  it("lazily mounts <chat-iva>, auto-registers the connector and sets it as a DOM property", async () => {
    const wrapper = mount(ChatIva, {
      props: { connector: makeFakeConnector("vue-chativa-connector-2") },
      attachTo: document.body,
    });

    await waitForElement(wrapper, "chat-iva");

    expect(ConnectorRegistry.has("vue-chativa-connector-2")).toBe(true);
    expect(chatStore.getState().activeConnector).toBe("vue-chativa-connector-2");

    const el = wrapper.find("chat-iva").element as HTMLElement & { connector: string };
    expect(el.connector).toBe("vue-chativa-connector-2");
    // Set as a property, not reflected as an attribute.
    expect(el.hasAttribute("connector")).toBe(false);
    expect((wrapper.vm as unknown as { element: HTMLElement | null }).element).toBe(el);
  });

  it("accepts a plain connector name string without auto-registering anything", async () => {
    ConnectorRegistry.register(makeFakeConnector("vue-chativa-connector-3"));

    const wrapper = mount(ChatIva, {
      props: { connector: "vue-chativa-connector-3" },
      attachTo: document.body,
    });
    await waitForElement(wrapper, "chat-iva");

    expect(chatStore.getState().activeConnector).toBe("vue-chativa-connector-3");
    ConnectorRegistry.unregister("vue-chativa-connector-3");
  });

  it("re-resolves the connector when the prop changes", async () => {
    const wrapper = mount(ChatIva, {
      props: { connector: makeFakeConnector("vue-chativa-connector-4a") },
      attachTo: document.body,
    });
    await waitForElement(wrapper, "chat-iva");

    await wrapper.setProps({ connector: makeFakeConnector("vue-chativa-connector-4b") });
    await nextTick();

    expect(ConnectorRegistry.has("vue-chativa-connector-4b")).toBe(true);
    expect(chatStore.getState().activeConnector).toBe("vue-chativa-connector-4b");
    const el = wrapper.find("chat-iva").element as HTMLElement & { connector: string };
    expect(el.connector).toBe("vue-chativa-connector-4b");
  });

  it("applies fullscreenOnly before the element connects, and treats false as no opinion", async () => {
    chatStore.getState().setFullscreen(false);
    chatStore.getState().setAllowFullscreen(true);

    const off = mount(ChatIva, {
      props: { connector: makeFakeConnector("vue-chativa-fs-1"), fullscreenOnly: false },
    });
    expect(chatStore.getState().isFullscreen).toBe(false);
    expect(chatStore.getState().allowFullscreen).toBe(true);
    off.unmount();

    const on = mount(ChatIva, {
      props: { connector: makeFakeConnector("vue-chativa-fs-2"), fullscreenOnly: true },
    });
    // Asserted synchronously: the store write happens in setup(), before
    // `<chat-iva>` exists to pick a window mode.
    expect(chatStore.getState().isFullscreen).toBe(true);
    expect(chatStore.getState().allowFullscreen).toBe(false);
    on.unmount();

    chatStore.getState().setFullscreen(false);
    chatStore.getState().setAllowFullscreen(true);

    const toggled = mount(ChatIva, {
      props: { connector: makeFakeConnector("vue-chativa-fs-3") },
    });
    await toggled.setProps({ fullscreenOnly: true });
    expect(chatStore.getState().isFullscreen).toBe(true);
    expect(chatStore.getState().allowFullscreen).toBe(false);

    chatStore.getState().setFullscreen(false);
    chatStore.getState().setAllowFullscreen(true);
  });

  it("re-emits EventBus activity as typed camelCase Vue events", async () => {
    const wrapper = mount(ChatIva, {
      props: { connector: makeFakeConnector("vue-chativa-connector-5") },
    });

    const message: IncomingMessage = {
      id: "vue-m1",
      type: "text",
      data: { text: "hi" },
      timestamp: Date.now(),
    };
    EventBus.emit("message_received", message);
    EventBus.emit("message_sent", { id: "vue-o1", type: "text", data: { text: "yo" }, timestamp: 1 });
    EventBus.emit("survey_submitted", { rating: 5 } as never);
    EventBus.emit("widget_opened", undefined);
    EventBus.emit("widget_closed", undefined);
    EventBus.emit("connector_status_changed", { status: "connected" });
    EventBus.emit("connector_status_changed", { status: "connecting" });
    EventBus.emit("connector_status_changed", { status: "disconnected" });
    EventBus.emit("connector_status_changed", { status: "error" });

    expect(wrapper.emitted("message")).toEqual([[message]]);
    expect(wrapper.emitted("messageSent")?.[0]?.[0]).toMatchObject({ id: "vue-o1" });
    expect(wrapper.emitted("surveySubmit")).toEqual([[{ rating: 5 }]]);
    expect(wrapper.emitted("widgetOpen")).toHaveLength(1);
    expect(wrapper.emitted("widgetClose")).toHaveLength(1);
    expect(wrapper.emitted("connect")).toHaveLength(1);
    expect(wrapper.emitted("disconnect")).toEqual([
      [{ status: "disconnected" }],
      [{ status: "error" }],
    ]);
  });

  it("stops listening to the EventBus once unmounted", () => {
    const wrapper = mount(ChatIva, {
      props: { connector: makeFakeConnector("vue-chativa-connector-6") },
    });
    wrapper.unmount();
    EventBus.emit("widget_opened", undefined);
    expect(wrapper.emitted("widgetOpen")).toBeUndefined();
  });

  it("maps the element's kebab-case chativa-reset DOM event to the chativaReset emit", async () => {
    const wrapper = mount(ChatIva, {
      props: { connector: makeFakeConnector("vue-chativa-connector-7") },
      attachTo: document.body,
    });
    await waitForElement(wrapper, "chat-iva");

    wrapper
      .find("chat-iva")
      .element.dispatchEvent(new CustomEvent("chativa-reset", { bubbles: true, composed: true }));

    expect(wrapper.emitted("chativaReset")).toHaveLength(1);
  });

  it("supports template-style @message listeners and forwards default-slot content", async () => {
    const received = ref<IncomingMessage[]>([]);
    const wrapper = mount(
      {
        render: () =>
          h(
            ChatIva,
            {
              connector: makeFakeConnector("vue-chativa-connector-8"),
              onMessage: (m: IncomingMessage) => received.value.push(m),
            },
            { default: () => h("span", { class: "slotted" }, "extra") },
          ),
      },
      { attachTo: document.body },
    );
    await waitForElement(wrapper, "chat-iva");

    expect(wrapper.find("chat-iva .slotted").exists()).toBe(true);

    const message: IncomingMessage = { id: "vue-m2", type: "text", data: { text: "x" }, timestamp: 1 };
    EventBus.emit("message_received", message);
    expect(received.value).toEqual([message]);
  });
});
