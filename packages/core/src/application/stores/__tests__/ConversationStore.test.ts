import { describe, it, expect, beforeEach } from "vitest";
import conversationStore from "../ConversationStore";
import type { Conversation } from "../../../domain/entities/Conversation";

function makeConv(id: string, status: Conversation["status"] = "open"): Conversation {
  return { id, title: `Conv ${id}`, status };
}

describe("ConversationStore", () => {
  beforeEach(() => {
    conversationStore.getState().setConversations([]);
    conversationStore.getState().setActive(null);
  });

  it("starts with empty conversations and no active id", () => {
    expect(conversationStore.getState().conversations).toHaveLength(0);
    expect(conversationStore.getState().activeConversationId).toBeNull();
  });

  it("setConversations replaces the entire list", () => {
    conversationStore.getState().setConversations([makeConv("a"), makeConv("b")]);
    expect(conversationStore.getState().conversations).toHaveLength(2);
  });

  it("setConversations overwrites previous list", () => {
    conversationStore.getState().setConversations([makeConv("old")]);
    conversationStore.getState().setConversations([makeConv("new1"), makeConv("new2")]);
    const ids = conversationStore.getState().conversations.map((c) => c.id);
    expect(ids).toEqual(["new1", "new2"]);
  });

  it("addConversation appends to the list", () => {
    conversationStore.getState().addConversation(makeConv("x"));
    conversationStore.getState().addConversation(makeConv("y"));
    expect(conversationStore.getState().conversations).toHaveLength(2);
    expect(conversationStore.getState().conversations[1].id).toBe("y");
  });

  it("updateConversation patches a matching conversation", () => {
    conversationStore.getState().setConversations([makeConv("u", "open")]);
    conversationStore.getState().updateConversation("u", { unreadCount: 5, status: "pending" });
    const c = conversationStore.getState().conversations.find((c) => c.id === "u");
    expect(c?.unreadCount).toBe(5);
    expect(c?.status).toBe("pending");
  });

  it("updateConversation does not affect other conversations", () => {
    conversationStore.getState().setConversations([makeConv("a"), makeConv("b")]);
    conversationStore.getState().updateConversation("a", { status: "closed" });
    const b = conversationStore.getState().conversations.find((c) => c.id === "b");
    expect(b?.status).toBe("open");
  });

  it("updateConversation is a no-op for unknown ids", () => {
    conversationStore.getState().setConversations([makeConv("a")]);
    conversationStore.getState().updateConversation("no-such-id", { status: "closed" });
    expect(conversationStore.getState().conversations[0].status).toBe("open");
  });

  it("removeConversation removes by id", () => {
    conversationStore.getState().setConversations([makeConv("a"), makeConv("b"), makeConv("c")]);
    conversationStore.getState().removeConversation("b");
    const ids = conversationStore.getState().conversations.map((c) => c.id);
    expect(ids).toEqual(["a", "c"]);
  });

  it("removeConversation is a no-op for unknown ids", () => {
    conversationStore.getState().setConversations([makeConv("a")]);
    conversationStore.getState().removeConversation("no-such");
    expect(conversationStore.getState().conversations).toHaveLength(1);
  });

  it("setActive sets the active conversation id", () => {
    conversationStore.getState().setActive("conv-abc");
    expect(conversationStore.getState().activeConversationId).toBe("conv-abc");
  });

  it("setActive(null) clears the active id", () => {
    conversationStore.getState().setActive("conv-abc");
    conversationStore.getState().setActive(null);
    expect(conversationStore.getState().activeConversationId).toBeNull();
  });

  it("cacheMessages and getCachedMessages round-trip", () => {
    const msgs = [
      { id: "m1", type: "text", data: { text: "hello" } },
      { id: "m2", type: "text", data: { text: "world" } },
    ];
    conversationStore.getState().cacheMessages("cache-test-1", msgs as never[]);
    const cached = conversationStore.getState().getCachedMessages("cache-test-1");
    expect(cached).toHaveLength(2);
    expect(cached[0].id).toBe("m1");
    expect(cached[1].id).toBe("m2");
  });

  it("getCachedMessages returns an empty array for uncached id", () => {
    expect(conversationStore.getState().getCachedMessages("no-cache-for-this")).toEqual([]);
  });

  it("cacheMessages overwrites a previous snapshot for the same id", () => {
    conversationStore.getState().cacheMessages("cache-test-2", [
      { id: "old", type: "text", data: {} } as never,
    ]);
    conversationStore.getState().cacheMessages("cache-test-2", [
      { id: "new", type: "text", data: {} } as never,
    ]);
    const cached = conversationStore.getState().getCachedMessages("cache-test-2");
    expect(cached).toHaveLength(1);
    expect(cached[0].id).toBe("new");
  });
});
