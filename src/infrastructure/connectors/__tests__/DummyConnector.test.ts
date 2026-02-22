import { describe, it, expect, vi, beforeEach } from "vitest";
import { DummyConnector } from "../DummyConnector";

describe("DummyConnector", () => {
  let connector: DummyConnector;

  beforeEach(() => {
    connector = new DummyConnector({ replyDelay: 0 });
  });

  it("has name 'dummy'", () => {
    expect(connector.name).toBe("dummy");
  });

  it("addSentToHistory is true", () => {
    expect(connector.addSentToHistory).toBe(true);
  });

  it("connect() resolves without error", async () => {
    await expect(connector.connect()).resolves.toBeUndefined();
  });

  it("disconnect() resolves without error", async () => {
    await connector.connect();
    await expect(connector.disconnect()).resolves.toBeUndefined();
  });

  it("replies with an echo message after sendMessage", async () => {
    await connector.connect();
    const handler = vi.fn();
    connector.onMessage(handler);
    await connector.sendMessage({
      id: "1",
      type: "text",
      data: { text: "ping" },
      timestamp: Date.now(),
    });
    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    const reply = handler.mock.calls[0][0];
    expect(reply.type).toBe("text");
    expect(reply.data.text).toContain("ping");
  });

  it("does not reply after disconnect", async () => {
    await connector.connect();
    const handler = vi.fn();
    connector.onMessage(handler);
    await connector.disconnect();
    await connector.sendMessage({
      id: "2",
      type: "text",
      data: { text: "ghost" },
      timestamp: Date.now(),
    });
    // Wait a tick — handler should NOT be called
    await new Promise((r) => setTimeout(r, 20));
    expect(handler).not.toHaveBeenCalled();
  });
});
