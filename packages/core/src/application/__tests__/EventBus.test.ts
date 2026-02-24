import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus } from "../EventBus";

describe("EventBus", () => {
  beforeEach(() => EventBus.clear());

  it("on() + emit() calls the registered handler with the payload", () => {
    const handler = vi.fn();
    EventBus.on("widget_opened", handler);
    EventBus.emit("widget_opened", undefined);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it("emits typed payload correctly for message_sent", () => {
    const handler = vi.fn();
    EventBus.on("message_sent", handler);
    const msg = { id: "1", type: "text", data: { text: "hi" }, timestamp: 0 };
    EventBus.emit("message_sent", msg as any);
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it("multiple handlers on the same event are all called", () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    EventBus.on("widget_closed", h1);
    EventBus.on("widget_closed", h2);
    EventBus.emit("widget_closed", undefined);
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it("off() removes only the target handler — others remain", () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    EventBus.on("history_loaded", h1);
    EventBus.on("history_loaded", h2);
    EventBus.off("history_loaded", h1);
    EventBus.emit("history_loaded", { count: 5 });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });

  it("off() on a non-registered handler does not throw", () => {
    const handler = vi.fn();
    expect(() => EventBus.off("widget_opened", handler)).not.toThrow();
  });

  it("emit() on an event with no listeners does not throw", () => {
    expect(() => EventBus.emit("file_uploaded", { name: "test.png", size: 1024 })).not.toThrow();
  });

  it("clear() removes all listeners", () => {
    const handler = vi.fn();
    EventBus.on("widget_opened", handler);
    EventBus.clear();
    EventBus.emit("widget_opened", undefined);
    expect(handler).not.toHaveBeenCalled();
  });

  it("registering the same handler twice only calls it once (Set semantics)", () => {
    const handler = vi.fn();
    EventBus.on("widget_opened", handler);
    EventBus.on("widget_opened", handler);
    EventBus.emit("widget_opened", undefined);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("search_query_changed emits query string payload", () => {
    const handler = vi.fn();
    EventBus.on("search_query_changed", handler);
    EventBus.emit("search_query_changed", { query: "hello" });
    expect(handler).toHaveBeenCalledWith({ query: "hello" });
  });

  it("connector_status_changed emits status payload", () => {
    const handler = vi.fn();
    EventBus.on("connector_status_changed", handler);
    EventBus.emit("connector_status_changed", { status: "connected" });
    expect(handler).toHaveBeenCalledWith({ status: "connected" });
  });

  it("handlers from different events do not interfere", () => {
    const opened = vi.fn();
    const closed = vi.fn();
    EventBus.on("widget_opened", opened);
    EventBus.on("widget_closed", closed);
    EventBus.emit("widget_opened", undefined);
    expect(opened).toHaveBeenCalledOnce();
    expect(closed).not.toHaveBeenCalled();
  });
});
