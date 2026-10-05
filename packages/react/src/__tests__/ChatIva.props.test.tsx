import * as React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { EventBus, chatStore, type IConnector } from "@chativa/core";
import { ChatIva } from "../ChatIva";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

describe("ChatIva props and callbacks", () => {
  it("leaves the active connector untouched when no connector prop is given", () => {
    chatStore.getState().setConnector("chativa-preexisting");
    const setConnector = vi.spyOn(chatStore.getState(), "setConnector");

    render(<ChatIva />);

    expect(setConnector).not.toHaveBeenCalled();
    expect(chatStore.getState().activeConnector).toBe("chativa-preexisting");
  });

  it("does not rewrite the store when the connector is already active", () => {
    chatStore.getState().setConnector("chativa-props-same");
    const setConnector = vi.spyOn(chatStore.getState(), "setConnector");

    render(<ChatIva connector="chativa-props-same" />);

    expect(setConnector).not.toHaveBeenCalled();
  });

  it("forwards className, ref and the resolved connector name to the element", async () => {
    const ref = React.createRef<HTMLElement>();
    render(
      <ChatIva ref={ref} className="my-chat" connector={makeFakeConnector("chativa-props-1")} />,
    );
    await waitForWidget();

    const el = document.querySelector("chat-iva") as HTMLElement & { connector: string };
    expect(el.classList.contains("my-chat")).toBe(true);
    await waitFor(() => expect(ref.current).toBe(el));
    expect(el.connector).toBe("chativa-props-1");
  });

  it("maps an error status to onDisconnect and ignores intermediate statuses", async () => {
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();

    render(
      <ChatIva
        connector={makeFakeConnector("chativa-props-2")}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
      />,
    );
    await waitForWidget();

    EventBus.emit("connector_status_changed", { status: "connecting" });
    expect(onConnect).not.toHaveBeenCalled();
    expect(onDisconnect).not.toHaveBeenCalled();

    EventBus.emit("connector_status_changed", { status: "error" });
    expect(onDisconnect).toHaveBeenCalledWith({ status: "error" });
  });

  it("maps message_sent and survey_submitted to onMessageSent / onSurveySubmit", async () => {
    const onMessageSent = vi.fn();
    const onSurveySubmit = vi.fn();
    render(
      <ChatIva
        connector={makeFakeConnector("chativa-props-3")}
        onMessageSent={onMessageSent}
        onSurveySubmit={onSurveySubmit}
      />,
    );
    await waitForWidget();

    const sent = { id: "o1", type: "text", data: { text: "hello" } };
    EventBus.emit("message_sent", sent as never);
    const survey = { rating: 5 };
    EventBus.emit("survey_submitted", survey as never);

    expect(onMessageSent).toHaveBeenCalledWith(sent);
    expect(onSurveySubmit).toHaveBeenCalledWith(survey);
  });

  it("tolerates status changes when no onConnect / onDisconnect are given", async () => {
    render(<ChatIva connector={makeFakeConnector("chativa-props-4")} />);
    await waitForWidget();
    expect(() => {
      EventBus.emit("connector_status_changed", { status: "connected" });
      EventBus.emit("connector_status_changed", { status: "disconnected" });
    }).not.toThrow();
  });

  it("stops invoking callbacks after unmount", async () => {
    const onMessage = vi.fn();
    const { unmount } = render(
      <ChatIva connector={makeFakeConnector("chativa-props-5")} onMessage={onMessage} />,
    );
    await waitForWidget();
    unmount();

    EventBus.emit("message_received", { id: "m", type: "text", data: {}, timestamp: 0 });
    expect(onMessage).not.toHaveBeenCalled();
  });
});
