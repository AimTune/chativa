import { describe, it, expect, vi, beforeEach } from "vitest";
import { DummyConnector } from "../DummyConnector";

describe("DummyConnector", () => {
  let connector: DummyConnector;

  beforeEach(() => {
    connector = new DummyConnector({ replyDelay: 0, connectDelay: 0 });
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

  it("/disconnect command triggers onDisconnect callback", async () => {
    await connector.connect();
    const disconnectHandler = vi.fn();
    connector.onDisconnect(disconnectHandler);
    await connector.sendMessage({
      id: "3",
      type: "text",
      data: { text: "/disconnect" },
      timestamp: Date.now(),
    });
    expect(disconnectHandler).toHaveBeenCalledOnce();
    expect(disconnectHandler).toHaveBeenCalledWith("user");
  });

  it("/disconnect command clears message handler", async () => {
    await connector.connect();
    const msgHandler = vi.fn();
    connector.onMessage(msgHandler);
    await connector.sendMessage({
      id: "4",
      type: "text",
      data: { text: "/disconnect" },
      timestamp: Date.now(),
    });
    // Subsequent messages should not reach the handler
    await connector.sendMessage({
      id: "5",
      type: "text",
      data: { text: "hello?" },
      timestamp: Date.now(),
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(msgHandler).not.toHaveBeenCalled();
  });

  // ── Name customisation ────────────────────────────────────────────

  it("accepts a custom name via options", () => {
    const named = new DummyConnector({ name: "my-connector", replyDelay: 0, connectDelay: 0 });
    expect(named.name).toBe("my-connector");
  });

  // ── Multi-conversation ────────────────────────────────────────────

  describe("multi-conversation", () => {
    beforeEach(async () => {
      await connector.connect();
    });

    it("listConversations returns 3 demo conversations", async () => {
      const convs = await connector.listConversations!();
      expect(convs).toHaveLength(3);
    });

    it("listConversations conversations have required fields", async () => {
      const convs = await connector.listConversations!();
      for (const c of convs) {
        expect(c.id).toBeDefined();
        expect(c.title).toBeDefined();
        expect(typeof c.status).toBe("string");
      }
    });

    it("listConversations returns a copy — mutations do not affect internal state", async () => {
      const convs = await connector.listConversations!();
      convs.splice(0, convs.length); // clear the returned array
      const convs2 = await connector.listConversations!();
      expect(convs2).toHaveLength(3);
    });

    it("createConversation returns a new conversation with the given title", async () => {
      const conv = await connector.createConversation!("Test Chat");
      expect(conv.title).toBe("Test Chat");
      expect(conv.id).toBeDefined();
      expect(conv.status).toBe("open");
    });

    it("createConversation uses a default title when none is provided", async () => {
      const conv = await connector.createConversation!();
      expect(conv.title).toBeDefined();
      expect(conv.title.length).toBeGreaterThan(0);
    });

    it("createConversation adds the new conversation to the list", async () => {
      await connector.createConversation!("Extra Conv");
      const convs = await connector.listConversations!();
      expect(convs).toHaveLength(4);
      expect(convs.some((c) => c.title === "Extra Conv")).toBe(true);
    });

    it("switchConversation resolves without error", async () => {
      await expect(connector.switchConversation!("conv-1")).resolves.toBeUndefined();
    });

    it("switchConversation injects a greeting on first visit", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.switchConversation!("conv-1");
      await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
      const msg = handler.mock.calls[0][0];
      expect(msg.type).toBe("text");
      expect(msg.from).toBe("bot");
    });

    it("switchConversation does not inject a greeting on subsequent visits", async () => {
      const handler = vi.fn();
      connector.onMessage(handler);
      await connector.switchConversation!("conv-2");
      await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
      handler.mockClear();
      // Visit again — no greeting this time
      await connector.switchConversation!("conv-2");
      await new Promise((r) => setTimeout(r, 300));
      expect(handler).not.toHaveBeenCalled();
    });

    it("closeConversation resolves without error", async () => {
      await expect(connector.closeConversation!("conv-1")).resolves.toBeUndefined();
    });

    it("closeConversation fires the onConversationUpdate callback", async () => {
      const updateHandler = vi.fn();
      connector.onConversationUpdate!(updateHandler);
      await connector.closeConversation!("conv-1");
      expect(updateHandler).toHaveBeenCalledOnce();
      expect(updateHandler.mock.calls[0][0]).toMatchObject({ id: "conv-1", status: "closed" });
    });

    it("onConversationUpdate registers without throwing", () => {
      expect(() => connector.onConversationUpdate!(() => {})).not.toThrow();
    });
  });
});
