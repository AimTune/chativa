import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/svelte";
import { createRawSnippet, flushSync } from "svelte";
import {
  EventBus,
  ConnectorRegistry,
  chatStore,
  type IncomingMessage,
  type OutgoingMessage,
  type SurveyPayload,
} from "@chativa/core";
import ChatIva from "../ChatIva.svelte";
import LegacyEvents from "./fixtures/LegacyEvents.svelte";
import { makeFakeConnector, waitForElement } from "./helpers";

const message: IncomingMessage = {
  id: "m1",
  type: "text",
  data: { text: "hi" },
  timestamp: Date.now(),
};
const sent: OutgoingMessage = { id: "o1", type: "text", data: { text: "yo" }, timestamp: Date.now() };
const survey: SurveyPayload = { rating: 5, comment: "great" };

describe("ChatIva", () => {
  it("renders nothing synchronously (the element only exists once @chativa/ui has loaded)", () => {
    const { container } = render(ChatIva, { connector: makeFakeConnector("svelte-ci-1") });
    expect(container.querySelector("chat-iva")).toBeNull();
  });

  it("lazily mounts <chat-iva>, auto-registers and activates the connector", async () => {
    render(ChatIva, { connector: makeFakeConnector("svelte-ci-2") });

    const el = await waitForElement("chat-iva");

    expect(customElements.get("chat-iva")).toBeDefined();
    expect(ConnectorRegistry.has("svelte-ci-2")).toBe(true);
    expect(chatStore.getState().activeConnector).toBe("svelte-ci-2");
    expect((el as HTMLElement & { connector: string }).connector).toBe("svelte-ci-2");
  });

  it("accepts a plain connector name string without auto-registering anything", async () => {
    ConnectorRegistry.register(makeFakeConnector("svelte-ci-3"));

    render(ChatIva, { connector: "svelte-ci-3" });
    await waitForElement("chat-iva");

    expect(chatStore.getState().activeConnector).toBe("svelte-ci-3");
    ConnectorRegistry.unregister("svelte-ci-3");
  });

  it("forwards class / style, renders children into the element and binds `element`", async () => {
    const children = createRawSnippet(() => ({ render: () => `<span class="slotted">extra</span>` }));
    let bound: HTMLElement | null = null;

    render(ChatIva, {
      connector: makeFakeConnector("svelte-ci-4"),
      class: "my-chat",
      style: "--chativa-primary-color: red",
      children,
      get element() {
        return bound;
      },
      set element(v) {
        bound = v ?? null;
      },
    });

    const el = await waitForElement("chat-iva");
    expect(el.classList.contains("my-chat")).toBe(true);
    expect(el.getAttribute("style")).toContain("--chativa-primary-color");
    expect(el.querySelector(".slotted")?.textContent).toBe("extra");
    expect(bound).toBe(el);
  });

  it("applies fullscreenOnly before the element connects, and treats false as no opinion", () => {
    chatStore.getState().setFullscreen(false);
    chatStore.getState().setAllowFullscreen(true);

    // Asserted synchronously, without waiting for the element to mount.
    const first = render(ChatIva, { connector: makeFakeConnector("svelte-ci-fs-1"), fullscreenOnly: false });
    flushSync();
    expect(chatStore.getState().isFullscreen).toBe(false);
    expect(chatStore.getState().allowFullscreen).toBe(true);
    first.unmount();

    render(ChatIva, { connector: makeFakeConnector("svelte-ci-fs-2"), fullscreenOnly: true });
    flushSync();
    expect(chatStore.getState().isFullscreen).toBe(true);
    expect(chatStore.getState().allowFullscreen).toBe(false);

    chatStore.getState().setFullscreen(false);
    chatStore.getState().setAllowFullscreen(true);
  });

  it("maps EventBus events to the callback props", async () => {
    const props = {
      connector: makeFakeConnector("svelte-ci-5"),
      onmessage: vi.fn(),
      onmessagesent: vi.fn(),
      onsurveysubmit: vi.fn(),
      onwidgetopen: vi.fn(),
      onwidgetclose: vi.fn(),
      onconnect: vi.fn(),
      ondisconnect: vi.fn(),
    };
    render(ChatIva, props);
    flushSync();

    EventBus.emit("message_received", message);
    EventBus.emit("message_sent", sent);
    EventBus.emit("survey_submitted", survey);
    EventBus.emit("widget_opened", undefined);
    EventBus.emit("widget_closed", undefined);
    EventBus.emit("connector_status_changed", { status: "connected" });
    EventBus.emit("connector_status_changed", { status: "connecting" });
    EventBus.emit("connector_status_changed", { status: "disconnected" });
    EventBus.emit("connector_status_changed", { status: "error" });

    expect(props.onmessage).toHaveBeenCalledWith(message);
    expect(props.onmessagesent).toHaveBeenCalledWith(sent);
    expect(props.onsurveysubmit).toHaveBeenCalledWith(survey);
    expect(props.onwidgetopen).toHaveBeenCalledTimes(1);
    expect(props.onwidgetclose).toHaveBeenCalledTimes(1);
    expect(props.onconnect).toHaveBeenCalledTimes(1);
    expect(props.ondisconnect).toHaveBeenNthCalledWith(1, { status: "disconnected" });
    expect(props.ondisconnect).toHaveBeenNthCalledWith(2, { status: "error" });
  });

  it("invokes the latest handler after a prop update and unsubscribes on unmount", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = render(ChatIva, {
      connector: makeFakeConnector("svelte-ci-6"),
      onmessage: first,
    });
    flushSync();

    void rerender({ onmessage: second });
    flushSync();
    EventBus.emit("message_received", message);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    unmount();
    EventBus.emit("message_received", message);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("ignores events with no handler bound", () => {
    render(ChatIva, { connector: makeFakeConnector("svelte-ci-7") });
    flushSync();
    expect(() => {
      EventBus.emit("message_received", message);
      EventBus.emit("message_sent", sent);
      EventBus.emit("survey_submitted", survey);
      EventBus.emit("widget_opened", undefined);
      EventBus.emit("widget_closed", undefined);
      EventBus.emit("connector_status_changed", { status: "connected" });
      EventBus.emit("connector_status_changed", { status: "disconnected" });
    }).not.toThrow();
  });

  it("does not mount the element if unmounted before @chativa/ui resolves", async () => {
    const { unmount } = render(ChatIva, { connector: makeFakeConnector("svelte-ci-8") });
    unmount();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector("chat-iva")).toBeNull();
  });

  it("supports Svelte 4-style `on:` listeners from a legacy-mode parent", () => {
    const log = vi.fn();
    render(LegacyEvents, { connector: makeFakeConnector("svelte-ci-9"), log });
    flushSync();

    EventBus.emit("message_received", message);
    EventBus.emit("message_sent", sent);
    EventBus.emit("survey_submitted", survey);
    EventBus.emit("widget_opened", undefined);
    EventBus.emit("widget_closed", undefined);
    EventBus.emit("connector_status_changed", { status: "connected" });
    EventBus.emit("connector_status_changed", { status: "disconnected" });

    const seen = log.mock.calls.map(([e]) => [(e as CustomEvent).type, (e as CustomEvent).detail]);
    expect(seen).toEqual([
      ["message", message],
      ["messagesent", sent],
      ["surveysubmit", survey],
      ["widgetopen", null],
      ["widgetclose", null],
      ["connect", null],
      ["disconnect", { status: "disconnected" }],
    ]);
  });
});
