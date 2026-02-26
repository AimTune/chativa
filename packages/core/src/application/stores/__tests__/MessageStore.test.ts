import { describe, it, expect, beforeEach } from "vitest";
import messageStore from "../MessageStore";

describe("MessageStore", () => {
  beforeEach(() => messageStore.getState().clear());

  it("starts with an empty messages array", () => {
    expect(messageStore.getState().messages).toHaveLength(0);
  });

  it("addMessage appends a message", () => {
    messageStore.getState().addMessage({ id: "1", type: "text", data: { text: "hi" } });
    expect(messageStore.getState().messages).toHaveLength(1);
  });

  it("deduplicates messages with the same id", () => {
    const msg = { id: "dup", type: "text", data: { text: "x" } };
    messageStore.getState().addMessage(msg);
    messageStore.getState().addMessage(msg);
    expect(messageStore.getState().messages).toHaveLength(1);
  });

  it("removeById removes the correct message", () => {
    messageStore.getState().addMessage({ id: "a", type: "text", data: {} });
    messageStore.getState().addMessage({ id: "b", type: "text", data: {} });
    messageStore.getState().removeById("a");
    const ids = messageStore.getState().messages.map((m) => m.id);
    expect(ids).toEqual(["b"]);
  });

  it("updateById patches message fields", () => {
    messageStore.getState().addMessage({ id: "u", type: "text", data: { text: "old" } });
    messageStore.getState().updateById("u", { data: { text: "new" } });
    const msg = messageStore.getState().messages.find((m) => m.id === "u");
    expect(msg?.data.text).toBe("new");
  });

  it("updateById only patches the matching message and leaves others unchanged", () => {
    messageStore.getState().addMessage({ id: "x", type: "text", data: { text: "x" } });
    messageStore.getState().addMessage({ id: "y", type: "text", data: { text: "y" } });
    messageStore.getState().updateById("x", { data: { text: "updated" } });
    const msgs = messageStore.getState().messages;
    expect(msgs.find((m) => m.id === "x")?.data.text).toBe("updated");
    expect(msgs.find((m) => m.id === "y")?.data.text).toBe("y");
  });

  it("clear empties the store", () => {
    messageStore.getState().addMessage({ id: "c", type: "text", data: {} });
    messageStore.getState().clear();
    expect(messageStore.getState().messages).toHaveLength(0);
  });

  it("clear allows re-adding the same id", () => {
    const msg = { id: "reuse", type: "text", data: {} };
    messageStore.getState().addMessage(msg);
    messageStore.getState().clear();
    messageStore.getState().addMessage(msg);
    expect(messageStore.getState().messages).toHaveLength(1);
  });

  // ── restoreMessages ────────────────────────────────────────────────

  it("restoreMessages replaces the message list", () => {
    messageStore.getState().addMessage({ id: "old-1", type: "text", data: {} });
    messageStore.getState().restoreMessages([
      { id: "new-1", type: "text", data: { text: "a" } },
      { id: "new-2", type: "text", data: { text: "b" } },
    ]);
    const msgs = messageStore.getState().messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[0].id).toBe("new-1");
    expect(msgs[1].id).toBe("new-2");
  });

  it("restoreMessages with empty array clears all messages", () => {
    messageStore.getState().addMessage({ id: "x", type: "text", data: {} });
    messageStore.getState().restoreMessages([]);
    expect(messageStore.getState().messages).toHaveLength(0);
  });

  it("restoreMessages resets deduplication — allows re-adding restored ids", () => {
    messageStore.getState().addMessage({ id: "dup", type: "text", data: {} });
    messageStore.getState().restoreMessages([]);
    messageStore.getState().addMessage({ id: "dup", type: "text", data: {} });
    expect(messageStore.getState().messages).toHaveLength(1);
  });

  it("restoreMessages tracks restored ids for future deduplication", () => {
    messageStore.getState().restoreMessages([
      { id: "r1", type: "text", data: {} },
    ]);
    // Attempting to add the same id again should be a no-op
    messageStore.getState().addMessage({ id: "r1", type: "text", data: {} });
    expect(messageStore.getState().messages).toHaveLength(1);
  });

  it("restoreMessages increments the version counter", () => {
    const before = messageStore.getState().version;
    messageStore.getState().restoreMessages([]);
    expect(messageStore.getState().version).toBeGreaterThan(before);
  });
});
