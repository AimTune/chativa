import { describe, it, expect } from "vitest";
import { parseChatFrame, createGenUIEventFrame } from "../ChatFrame";

const at = (n: number) => ({ now: () => n });

describe("parseChatFrame — tool_call", () => {
  it("reads a nested tool_call payload", () => {
    const frame = parseChatFrame({
      type: "tool_call",
      data: { id: "c1", name: "get_weather", status: "running", params: { city: "Ankara" } },
    });
    expect(frame).toEqual({
      kind: "tool_call",
      toolCall: { id: "c1", name: "get_weather", status: "running", params: { city: "Ankara" } },
    });
  });

  it("reads a tool_call flattened onto the frame", () => {
    const frame = parseChatFrame({ type: "tool_call", id: "c1", name: "t", status: "completed" });
    expect(frame.kind).toBe("tool_call");
  });

  it("rejects a malformed tool_call instead of fabricating a trace", () => {
    // No status — an activity row with an unknown lifecycle state would be
    // worse than ignoring the frame.
    expect(parseChatFrame({ type: "tool_call", data: { id: "c1", name: "t" } }).kind).toBe("other");
  });
});

describe("parseChatFrame — genui", () => {
  it("reads a genui chunk", () => {
    const frame = parseChatFrame({
      type: "genui",
      streamId: "s1",
      chunk: { type: "ui", component: "weather", props: { city: "Izmir" }, id: 1 },
      done: false,
    });
    expect(frame).toMatchObject({
      kind: "genui",
      streamId: "s1",
      done: false,
      chunk: { component: "weather" },
    });
  });

  it("defaults `done` to false when absent", () => {
    const frame = parseChatFrame({ type: "genui", streamId: "s1", chunk: { type: "text", content: "hi", id: 1 } });
    expect(frame).toMatchObject({ kind: "genui", done: false });
  });

  it("carries done: true through", () => {
    const frame = parseChatFrame({ type: "genui", streamId: "s1", chunk: { type: "text", content: "", id: 2 }, done: true });
    expect(frame).toMatchObject({ kind: "genui", done: true });
  });

  it("ignores a genui frame with no streamId — chunks would have nowhere to land", () => {
    expect(parseChatFrame({ type: "genui", chunk: { type: "text", content: "x", id: 1 } }).kind).toBe("other");
  });

  it("ignores a genui frame with no chunk", () => {
    expect(parseChatFrame({ type: "genui", streamId: "s1" }).kind).toBe("other");
  });
});

describe("parseChatFrame — typing", () => {
  it("reads isTyping", () => {
    expect(parseChatFrame({ type: "typing", isTyping: true })).toEqual({ kind: "typing", isTyping: true });
    expect(parseChatFrame({ type: "typing", isTyping: false })).toEqual({ kind: "typing", isTyping: false });
  });

  it("treats a missing isTyping as off", () => {
    expect(parseChatFrame({ type: "typing" })).toEqual({ kind: "typing", isTyping: false });
  });
});

describe("parseChatFrame — human-in-the-loop", () => {
  it("maps a bot text frame with actions to a quick-reply that keeps its chips", () => {
    const frame = parseChatFrame({
      type: "text",
      id: "m1",
      from: "bot",
      data: { text: "Deploy to production?" },
      actions: [{ label: "Approve" }, { label: "Cancel" }],
      timestamp: 1700,
    });
    expect(frame).toEqual({
      kind: "quick_reply",
      message: {
        id: "m1",
        type: "quick-reply",
        data: {
          text: "Deploy to production?",
          actions: [{ label: "Approve" }, { label: "Cancel" }],
          keepActions: true,
        },
        timestamp: 1700,
      },
    });
  });

  it("does not remap a replayed user frame that carries actions", () => {
    // The user's own message fanned back out — re-offering the chips would
    // invite answering the same question twice.
    const frame = parseChatFrame({
      type: "text",
      from: "user",
      data: { text: "Approve" },
      actions: [{ label: "Approve" }],
    });
    expect(frame.kind).toBe("other");
  });

  it("leaves a plain bot text frame alone", () => {
    expect(parseChatFrame({ type: "text", id: "m1", data: { text: "hi" } }).kind).toBe("other");
  });

  it("leaves a bot text frame with an empty actions array alone", () => {
    expect(parseChatFrame({ type: "text", id: "m1", data: { text: "hi" }, actions: [] }).kind).toBe("other");
  });

  it("mints a prefixed id and timestamp when the frame carries none", () => {
    const frame = parseChatFrame(
      { type: "text", data: { text: "?" }, actions: [{ label: "Yes" }] },
      { idPrefix: "signalr", ...at(4242) },
    );
    expect(frame).toMatchObject({ kind: "quick_reply", message: { id: "signalr-4242", timestamp: 4242 } });
  });
});

describe("parseChatFrame — passthrough", () => {
  it.each([
    ["a plain message", { type: "image", id: "m2", data: { url: "x.png" } }],
    ["an SSE connected notice", { type: "connected" }],
    ["a botiva welcome", { type: "welcome", data: { userId: "u1" } }],
    ["an unknown type", { type: "something_new", data: {} }],
    ["a typeless object", { hello: 1 }],
  ])("leaves %s to the connector", (_label, payload) => {
    expect(parseChatFrame(payload).kind).toBe("other");
  });

  it.each([
    ["null", null],
    ["a string", "hello"],
    ["a number", 42],
    ["an array", [1, 2]],
  ])("treats %s as other rather than throwing", (_label, payload) => {
    expect(parseChatFrame(payload).kind).toBe("other");
  });
});

describe("createGenUIEventFrame", () => {
  it("builds the outbound genui_event frame", () => {
    expect(createGenUIEventFrame("s1", "form_submit", { answer: 42 })).toEqual({
      type: "genui_event",
      streamId: "s1",
      eventType: "form_submit",
      payload: { answer: 42 },
    });
  });
});
