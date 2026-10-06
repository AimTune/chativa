import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { EventBus, type EventBusEventName, type EventBusPayloadMap } from "@chativa/core";
import { useChativaEvent } from "../useChativaEvent";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type Handler = ((payload: EventBusPayloadMap["widget_opened"]) => void) | undefined;

describe("useChativaEvent", () => {
  it("invokes the handler when the EventBus emits the event", () => {
    const handler = vi.fn();
    renderHook(() => useChativaEvent("widget_opened", handler));

    EventBus.emit("widget_opened", undefined);

    expect(handler).toHaveBeenCalledOnce();
  });

  it("passes the event payload through", () => {
    const handler = vi.fn();
    renderHook(() => useChativaEvent("connector_status_changed", handler));

    EventBus.emit("connector_status_changed", { status: "connected" });

    expect(handler).toHaveBeenCalledWith({ status: "connected" });
  });

  it("always calls the latest handler without re-subscribing on every render", () => {
    const onSpy = vi.spyOn(EventBus, "on");
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(({ h }: { h: Handler }) => useChativaEvent("widget_opened", h), {
      initialProps: { h: first as Handler },
    });
    rerender({ h: second });

    EventBus.emit("widget_opened", undefined);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(onSpy).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe while the handler is undefined, and subscribes once one is provided", () => {
    const onSpy = vi.spyOn(EventBus, "on");
    const handler = vi.fn();

    const { rerender } = renderHook(({ h }: { h: Handler }) => useChativaEvent("widget_opened", h), {
      initialProps: { h: undefined as Handler },
    });
    expect(onSpy).not.toHaveBeenCalled();

    rerender({ h: handler });
    EventBus.emit("widget_opened", undefined);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("unsubscribes when the handler is removed", () => {
    const handler = vi.fn();
    const { rerender } = renderHook(({ h }: { h: Handler }) => useChativaEvent("widget_opened", h), {
      initialProps: { h: handler as Handler },
    });

    rerender({ h: undefined });
    EventBus.emit("widget_opened", undefined);

    expect(handler).not.toHaveBeenCalled();
  });

  it("re-subscribes when the event name changes", () => {
    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ name }: { name: EventBusEventName }) =>
        useChativaEvent(name, handler as (payload: unknown) => void),
      { initialProps: { name: "widget_opened" as EventBusEventName } },
    );

    rerender({ name: "widget_closed" });
    EventBus.emit("widget_opened", undefined);
    EventBus.emit("widget_closed", undefined);

    expect(handler).toHaveBeenCalledOnce();
  });

  it("unsubscribes on unmount", () => {
    const offSpy = vi.spyOn(EventBus, "off");
    const handler = vi.fn();
    const { unmount } = renderHook(() => useChativaEvent("widget_closed", handler));

    unmount();
    EventBus.emit("widget_closed", undefined);

    expect(handler).not.toHaveBeenCalled();
    expect(offSpy).toHaveBeenCalledWith("widget_closed", expect.any(Function));
  });
});
