import { describe, it, expect, vi, beforeEach } from "vitest";
import { MultiConversationEngine } from "../MultiConversationEngine";
import { MessageTypeRegistry } from "../registries/MessageTypeRegistry";
import { ExtensionRegistry } from "../registries/ExtensionRegistry";
import conversationStore from "../stores/ConversationStore";
import messageStore from "../stores/MessageStore";
import type { IConnector, MessageHandler } from "../../domain/ports/IConnector";
import type { Conversation } from "../../domain/entities/Conversation";

const FallbackComponent = class extends HTMLElement {} as typeof HTMLElement;

function makeConv(id: string, status: Conversation["status"] = "open"): Conversation {
  return { id, title: `Conv ${id}`, status };
}

/** Build a fully-featured mock connector that supports multi-conversation. */
function createMockConnector(convs: Conversation[] = []): IConnector & {
  simulateIncoming: (text: string) => void;
} {
  let handler: MessageHandler | null = null;
  return {
    name: "mock-multi",
    addSentToHistory: true,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage(cb) { handler = cb; },
    simulateIncoming(text: string) {
      handler?.({ id: `sim-${Date.now()}`, type: "text", data: { text }, timestamp: Date.now() });
    },
    listConversations: vi.fn().mockResolvedValue(convs),
    switchConversation: vi.fn().mockResolvedValue(undefined),
    createConversation: vi.fn().mockImplementation(async (title?: string) =>
      makeConv(title ?? "new-conv")
    ),
    closeConversation: vi.fn().mockResolvedValue(undefined),
    onConversationUpdate: vi.fn(),
  };
}

describe("MultiConversationEngine", () => {
  beforeEach(() => {
    messageStore.getState().clear();
    conversationStore.getState().setConversations([]);
    conversationStore.getState().setActive(null);
    MessageTypeRegistry.clear();
    ExtensionRegistry.clear();
    MessageTypeRegistry.setFallback(FallbackComponent);
  });

  // ── Basic structure ─────────────────────────────────────────────────

  it("exposes chatEngine accessor", () => {
    const engine = new MultiConversationEngine(createMockConnector());
    expect(engine.chatEngine).toBeDefined();
  });

  it("chatEngine is the same instance across calls", () => {
    const engine = new MultiConversationEngine(createMockConnector());
    expect(engine.chatEngine).toBe(engine.chatEngine);
  });

  // ── init ────────────────────────────────────────────────────────────

  it("init loads conversations into the store", async () => {
    const convs = [makeConv("c1"), makeConv("c2")];
    const connector = createMockConnector(convs);
    const engine = new MultiConversationEngine(connector);
    await engine.init();
    expect(conversationStore.getState().conversations).toHaveLength(2);
    await engine.destroy();
  });

  it("init auto-activates the first open conversation", async () => {
    const convs = [makeConv("c1", "open"), makeConv("c2", "open")];
    const connector = createMockConnector(convs);
    const engine = new MultiConversationEngine(connector);
    await engine.init();
    expect(conversationStore.getState().activeConversationId).toBe("c1");
    await engine.destroy();
  });

  it("init prefers 'open' over 'pending' conversations for auto-activation", async () => {
    const convs = [makeConv("pending-1", "pending"), makeConv("open-1", "open")];
    const connector = createMockConnector(convs);
    const engine = new MultiConversationEngine(connector);
    await engine.init();
    expect(conversationStore.getState().activeConversationId).toBe("pending-1");
    await engine.destroy();
  });

  it("init registers onConversationUpdate if connector supports it", async () => {
    const connector = createMockConnector([makeConv("c1")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();
    expect(connector.onConversationUpdate).toHaveBeenCalledOnce();
    await engine.destroy();
  });

  it("init skips listConversations when connector does not implement it", async () => {
    const connector = createMockConnector();
    delete (connector as Partial<typeof connector>).listConversations;
    const engine = new MultiConversationEngine(connector);
    await engine.init(); // should not throw
    expect(conversationStore.getState().conversations).toHaveLength(0);
    await engine.destroy();
  });

  // ── switchTo ────────────────────────────────────────────────────────

  it("switchTo changes the active conversation id", async () => {
    const connector = createMockConnector([makeConv("c1"), makeConv("c2")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();
    await engine.switchTo("c2");
    expect(conversationStore.getState().activeConversationId).toBe("c2");
    await engine.destroy();
  });

  it("switchTo caches messages from the current conversation", async () => {
    const connector = createMockConnector([makeConv("c1"), makeConv("c2")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    messageStore.getState().addMessage({ id: "msg-c1", type: "text", data: { text: "in c1" } });

    await engine.switchTo("c2");

    const cached = conversationStore.getState().getCachedMessages("c1");
    expect(cached.some((m) => m.id === "msg-c1")).toBe(true);
    await engine.destroy();
  });

  it("switchTo restores cached messages for the target conversation", async () => {
    const connector = createMockConnector([makeConv("c1"), makeConv("c2")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    // Pre-cache some messages for c2
    conversationStore.getState().cacheMessages("c2", [
      { id: "msg-c2", type: "text", data: { text: "in c2" } } as never,
    ]);

    await engine.switchTo("c2");

    expect(messageStore.getState().messages.some((m) => m.id === "msg-c2")).toBe(true);
    await engine.destroy();
  });

  it("switchTo resets unread count to 0 for the target conversation", async () => {
    const convs: Conversation[] = [
      { ...makeConv("c1"), unreadCount: 3 },
      { ...makeConv("c2"), unreadCount: 5 },
    ];
    const connector = createMockConnector(convs);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    await engine.switchTo("c2");

    const c2 = conversationStore.getState().conversations.find((c) => c.id === "c2");
    expect(c2?.unreadCount).toBe(0);
    await engine.destroy();
  });

  it("switchTo is a no-op when target is already active", async () => {
    const connector = createMockConnector([makeConv("c1"), makeConv("c2")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init(); // c1 is active

    await engine.switchTo("c1");

    expect(connector.switchConversation).not.toHaveBeenCalled();
    await engine.destroy();
  });

  it("switchTo calls connector.switchConversation with the target id", async () => {
    const connector = createMockConnector([makeConv("c1"), makeConv("c2")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    await engine.switchTo("c2");

    expect(connector.switchConversation).toHaveBeenCalledWith("c2");
    await engine.destroy();
  });

  // ── createNew ───────────────────────────────────────────────────────

  it("createNew adds the new conversation to the store", async () => {
    const connector = createMockConnector([makeConv("c1")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    await engine.createNew("my-new-conv");

    expect(conversationStore.getState().conversations.some((c) => c.id === "my-new-conv")).toBe(true);
    await engine.destroy();
  });

  it("createNew switches to the newly created conversation", async () => {
    const connector = createMockConnector([makeConv("c1")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    await engine.createNew("my-new-conv");

    expect(conversationStore.getState().activeConversationId).toBe("my-new-conv");
    await engine.destroy();
  });

  it("createNew returns the created conversation object", async () => {
    const connector = createMockConnector([makeConv("c1")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    const result = await engine.createNew("my-new-conv");

    expect(result?.id).toBe("my-new-conv");
    await engine.destroy();
  });

  it("createNew returns null when connector does not support createConversation", async () => {
    const connector = createMockConnector([makeConv("c1")]);
    delete (connector as Partial<typeof connector>).createConversation;
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    const result = await engine.createNew();
    expect(result).toBeNull();
    await engine.destroy();
  });

  // ── close ───────────────────────────────────────────────────────────

  it("close marks the conversation as closed", async () => {
    const connector = createMockConnector([makeConv("c1"), makeConv("c2")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    await engine.close("c2");

    const c2 = conversationStore.getState().conversations.find((c) => c.id === "c2");
    expect(c2?.status).toBe("closed");
    await engine.destroy();
  });

  it("close switches to another conversation when closing the active one", async () => {
    const connector = createMockConnector([makeConv("c1"), makeConv("c2")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();
    expect(conversationStore.getState().activeConversationId).toBe("c1");

    await engine.close("c1");

    expect(conversationStore.getState().activeConversationId).toBe("c2");
    await engine.destroy();
  });

  it("close sets active to null when no other open conversations remain", async () => {
    const connector = createMockConnector([makeConv("c1")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    await engine.close("c1");

    expect(conversationStore.getState().activeConversationId).toBeNull();
    await engine.destroy();
  });

  it("close calls connector.closeConversation with the target id", async () => {
    const connector = createMockConnector([makeConv("c1"), makeConv("c2")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    await engine.close("c2");

    expect(connector.closeConversation).toHaveBeenCalledWith("c2");
    await engine.destroy();
  });

  it("close is a no-op when connector does not support closeConversation", async () => {
    const connector = createMockConnector([makeConv("c1"), makeConv("c2")]);
    delete (connector as Partial<typeof connector>).closeConversation;
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    await engine.close("c2"); // should not throw

    const c2 = conversationStore.getState().conversations.find((c) => c.id === "c2");
    expect(c2?.status).toBe("open"); // unchanged
    await engine.destroy();
  });

  // ── destroy ─────────────────────────────────────────────────────────

  it("destroy clears the conversation list", async () => {
    const connector = createMockConnector([makeConv("c1"), makeConv("c2")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    await engine.destroy();

    expect(conversationStore.getState().conversations).toHaveLength(0);
  });

  it("destroy sets activeConversationId to null", async () => {
    const connector = createMockConnector([makeConv("c1")]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    await engine.destroy();

    expect(conversationStore.getState().activeConversationId).toBeNull();
  });
});
