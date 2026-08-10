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

/**
 * Wait for the lazily-imported `<chat-iva>` to mount. The first mount in a file
 * pays for the dynamic `import("@chativa/ui")`, which regularly overruns
 * `waitFor`'s 1s default in a cold Vitest worker — hence the explicit timeout.
 */
function waitForWidget() {
  return waitFor(() => {
    expect(document.querySelector("chat-iva")).not.toBeNull();
  }, { timeout: 15000 });
}

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

    await waitForWidget();

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

    await waitForWidget();

    expect(chatStore.getState().activeConnector).toBe("chativa-test-connector-3");

    ConnectorRegistry.unregister("chativa-test-connector-3");
  });

  it("applies fullscreenOnly before the element connects, and treats false as no opinion", () => {
    chatStore.getState().setFullscreen(false);
    chatStore.getState().setAllowFullscreen(true);

    // Asserted synchronously, without waiting for the element to mount: that is
    // the point of routing this through the store rather than through a
    // `fullscreenOnly` element property, which `@lit/react` would only assign
    // after `<chat-iva>` has already connected and picked a window mode.
    const { unmount } = render(
      <ChatIva connector={makeFakeConnector("chativa-test-connector-fs-1")} fullscreenOnly={false} />,
    );
    expect(chatStore.getState().isFullscreen).toBe(false);
    expect(chatStore.getState().allowFullscreen).toBe(true);
    unmount();

    render(<ChatIva connector={makeFakeConnector("chativa-test-connector-fs-2")} fullscreenOnly />);
    expect(chatStore.getState().isFullscreen).toBe(true);
    expect(chatStore.getState().allowFullscreen).toBe(false);

    chatStore.getState().setFullscreen(false);
    chatStore.getState().setAllowFullscreen(true);
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

    await waitForWidget();

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

    await waitForWidget();

    EventBus.emit("connector_status_changed", { status: "connected" });
    EventBus.emit("connector_status_changed", { status: "disconnected" });

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledWith({ status: "disconnected" });
  });
});
