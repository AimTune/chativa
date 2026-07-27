import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import {
  EventBus,
  ConnectorRegistry,
  chatStore,
  type IConnector,
  type IncomingMessage,
} from "@chativa/core";
import { ChatIva } from "../ChatIva";

afterEach(() => {
  cleanup();
});

function makeFakeConnector(name: string): IConnector {
  return {
    name,
    async connect() {},
    async disconnect() {},
    async sendMessage() {},
    onMessage() {},
  };
}

describe("ChatIva", () => {
  it("renders nothing synchronously (SSR-safe: no window/document use before mount)", () => {
    const connector = makeFakeConnector("chativa-test-connector-1");
    const { container } = render(<ChatIva connector={connector} />);
    expect(container.querySelector("chat-iva")).toBeNull();
  });

  it("lazily mounts the underlying <chat-iva> element and activates the resolved connector", async () => {
    const connector = makeFakeConnector("chativa-test-connector-2");

    render(<ChatIva connector={connector} />);

    await waitFor(() => {
      expect(document.querySelector("chat-iva")).not.toBeNull();
    });

    expect(ConnectorRegistry.has("chativa-test-connector-2")).toBe(true);
    // `ChatWidget.connectedCallback` reads `chatStore.activeConnector` (in
    // preference to its own `connector` property, which `@lit/react` only
    // applies post-mount via a ref) — this is what actually determines which
    // connector the widget connects to.
    expect(chatStore.getState().activeConnector).toBe("chativa-test-connector-2");
  });

  it("accepts a plain connector name string without auto-registering anything", async () => {
    const connector = makeFakeConnector("chativa-test-connector-3");
    ConnectorRegistry.register(connector);

    render(<ChatIva connector="chativa-test-connector-3" />);

    await waitFor(() => {
      expect(document.querySelector("chat-iva")).not.toBeNull();
    });

    expect(chatStore.getState().activeConnector).toBe("chativa-test-connector-3");

    ConnectorRegistry.unregister("chativa-test-connector-3");
  });

  it("maps EventBus events to onMessage / onWidgetOpen / onWidgetClose props", async () => {
    const connector = makeFakeConnector("chativa-test-connector-4");
    const onMessage = vi.fn();
    const onWidgetOpen = vi.fn();
    const onWidgetClose = vi.fn();

    render(
      <ChatIva
        connector={connector}
        onMessage={onMessage}
        onWidgetOpen={onWidgetOpen}
        onWidgetClose={onWidgetClose}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector("chat-iva")).not.toBeNull();
    });

    const message: IncomingMessage = {
      id: "m1",
      type: "text",
      data: { text: "hi" },
      timestamp: Date.now(),
    };
    EventBus.emit("message_received", message);
    EventBus.emit("widget_opened", undefined);
    EventBus.emit("widget_closed", undefined);

    expect(onMessage).toHaveBeenCalledWith(message);
    expect(onWidgetOpen).toHaveBeenCalledTimes(1);
    expect(onWidgetClose).toHaveBeenCalledTimes(1);
  });

  it("maps connector_status_changed to onConnect / onDisconnect", async () => {
    const connector = makeFakeConnector("chativa-test-connector-5");
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();

    render(<ChatIva connector={connector} onConnect={onConnect} onDisconnect={onDisconnect} />);

    await waitFor(() => {
      expect(document.querySelector("chat-iva")).not.toBeNull();
    });

    EventBus.emit("connector_status_changed", { status: "connected" });
    EventBus.emit("connector_status_changed", { status: "disconnected" });

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledWith({ status: "disconnected" });
  });
});
