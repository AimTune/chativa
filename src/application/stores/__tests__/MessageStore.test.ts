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
});
