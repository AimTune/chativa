import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AIChunk, OutgoingMessage } from "@chativa/core";
import { DummyConnector, type DummyRule } from "../index";

function out(text: string, type = "text"): OutgoingMessage {
  return { id: `u-${Math.random().toString(36).slice(2)}`, type, data: { text }, timestamp: Date.now() };
}

const helpRule: DummyRule = {
  when: { textMatches: "^/(help|yardım)$" },
  then: {
    id: "help",
    type: "buttons",
    from: "bot",
    data: { text: "Pick one", buttons: [{ label: "Order status" }, { label: "Talk to a human" }] },
  },
};

const cancelChunks: AIChunk[] = [
  { type: "text", content: "Cancelling — confirm below:", id: 1 },
  { type: "ui", component: "genui-form", props: { title: "Confirm" }, id: 2 },
];

describe("DummyConnector rules", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function setup(rules: DummyRule[], replyDelay = 0) {
    const connector = new DummyConnector({ replyDelay, connectDelay: 0, rules });
    const onMessage = vi.fn();
    const onChunk = vi.fn();
    connector.onMessage(onMessage);
    connector.onGenUIChunk(onChunk);
    return { connector, onMessage, onChunk };
  }

  it("exposes the configured rules", async () => {
    const { connector } = await setup([helpRule]);
    expect(connector.rules).toEqual([helpRule]);
    expect(new DummyConnector().rules).toEqual([]);
  });

  it("emits the configured message when textMatches matches", async () => {
    const { connector, onMessage } = await setup([helpRule]);
    await connector.sendMessage(out("/help"));
    vi.runAllTimers();
    expect(onMessage).toHaveBeenCalledOnce();
    const msg = onMessage.mock.calls[0][0];
    expect(msg.type).toBe("buttons");
    expect(msg.id).toBe("help");
    expect(msg.data.buttons).toHaveLength(2);
    expect(typeof msg.timestamp).toBe("number");
  });

  it("matches unicode alternatives in the regex", async () => {
    const { connector, onMessage } = await setup([helpRule]);
    await connector.sendMessage(out("/yardım"));
    vi.runAllTimers();
    expect(onMessage.mock.calls[0][0].type).toBe("buttons");
  });

  it("falls through to the default echo when no rule matches", async () => {
    const { connector, onMessage } = await setup([helpRule]);
    await connector.sendMessage(out("hello"));
    vi.runAllTimers();
    expect(onMessage).toHaveBeenCalledOnce();
    expect(onMessage.mock.calls[0][0].data.text).toBe("Echo: hello");
  });

  it("falls through to built-in demo commands when no rule matches", async () => {
    const { connector, onChunk, onMessage } = await setup([helpRule]);
    await connector.sendMessage(out("/genui-weather"));
    vi.runAllTimers();
    expect(onMessage).not.toHaveBeenCalled();
    expect(onChunk.mock.calls.some(([, c]) => (c as AIChunk).type === "ui" && (c as { component: string }).component === "weather")).toBe(true);
  });

  it("first matching rule wins (evaluation order)", async () => {
    const rules: DummyRule[] = [
      { when: { textMatches: "order" }, then: { id: "a", type: "text", data: { text: "first" } } },
      { when: { textMatches: "order status" }, then: { id: "b", type: "text", data: { text: "second" } } },
    ];
    const { connector, onMessage } = await setup(rules);
    await connector.sendMessage(out("order status"));
    vi.runAllTimers();
    expect(onMessage).toHaveBeenCalledOnce();
    expect(onMessage.mock.calls[0][0].data.text).toBe("first");
  });

  it("rules take precedence over built-in demo commands", async () => {
    const rules: DummyRule[] = [
      { when: { textMatches: "^/genui" }, then: { id: "x", type: "text", data: { text: "overridden" } } },
    ];
    const { connector, onMessage, onChunk } = await setup(rules);
    await connector.sendMessage(out("/genui"));
    vi.runAllTimers();
    expect(onChunk).not.toHaveBeenCalled();
    expect(onMessage.mock.calls[0][0].data.text).toBe("overridden");
  });

  it("matches by message type, ANDed with textMatches", async () => {
    const rules: DummyRule[] = [
      { when: { type: "location", textMatches: "^here$" }, then: { id: "loc", type: "text", data: { text: "got location" } } },
      { when: { type: "command" }, then: { id: "cmd", type: "text", data: { text: "got command" } } },
    ];
    const { connector, onMessage } = await setup(rules);

    await connector.sendMessage(out("here", "text")); // wrong type → echo
    await connector.sendMessage(out("there", "location")); // wrong text → echo
    await connector.sendMessage(out("anything", "command"));
    await connector.sendMessage(out("here", "location"));
    vi.runAllTimers();

    const texts = onMessage.mock.calls.map(([m]) => m.data.text);
    expect(texts).toEqual(["Echo: here", "Echo: there", "got command", "got location"]);
  });

  it("an empty `when` matches every message", async () => {
    const { connector, onMessage } = await setup([
      { when: {}, then: { id: "all", type: "text", data: { text: "catch-all" } } },
    ]);
    await connector.sendMessage(out("whatever"));
    vi.runAllTimers();
    expect(onMessage.mock.calls[0][0].data.text).toBe("catch-all");
  });

  it("gives repeated emissions a fresh id so they never collide", async () => {
    const { connector, onMessage } = await setup([helpRule]);
    await connector.sendMessage(out("/help"));
    await connector.sendMessage(out("/help"));
    await connector.sendMessage(out("/help"));
    vi.runAllTimers();
    const ids = onMessage.mock.calls.map(([m]) => m.id);
    expect(ids[0]).toBe("help");
    expect(new Set(ids).size).toBe(3);
  });

  it("does not mutate the rule template when emitting", async () => {
    const rule: DummyRule = {
      when: { textMatches: "x" },
      then: { id: "t", type: "text", data: { text: "x" } },
    };
    const { connector, onMessage } = await setup([rule]);
    await connector.sendMessage(out("x"));
    vi.runAllTimers();
    onMessage.mock.calls[0][0].data.text = "mutated";
    expect((rule.then as unknown as { data: { text: string } }).data.text).toBe("x");
    expect((rule.then as { timestamp?: number }).timestamp).toBeUndefined();
  });

  it("uses replyDelay when the rule has no delay", async () => {
    const { connector, onMessage } = await setup([helpRule], 800);
    await connector.sendMessage(out("/help"));
    vi.advanceTimersByTime(799);
    expect(onMessage).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onMessage).toHaveBeenCalledOnce();
  });

  it("honours a per-rule delay over replyDelay", async () => {
    const { connector, onMessage } = await setup([{ ...helpRule, delay: 50 }], 800);
    await connector.sendMessage(out("/help"));
    vi.advanceTimersByTime(49);
    expect(onMessage).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onMessage).toHaveBeenCalledOnce();
  });

  it("supports delay: 0 even when replyDelay is larger", async () => {
    const { connector, onMessage } = await setup([{ ...helpRule, delay: 0 }], 800);
    await connector.sendMessage(out("/help"));
    vi.advanceTimersByTime(0);
    expect(onMessage).toHaveBeenCalledOnce();
  });

  it("toggles typing and marks the user message read", async () => {
    const { connector } = await setup([helpRule], 100);
    const onTyping = vi.fn();
    const onStatus = vi.fn();
    connector.onTyping(onTyping);
    connector.onMessageStatus(onStatus);
    const msg = out("/help");
    await connector.sendMessage(msg);
    expect(onTyping).toHaveBeenLastCalledWith(true);
    vi.advanceTimersByTime(100);
    expect(onTyping).toHaveBeenLastCalledWith(false);
    expect(onStatus).toHaveBeenCalledWith(msg.id, "read");
  });

  it("emits GenUI chunks through the genUIChunkHandler", async () => {
    const { connector, onChunk, onMessage } = await setup([
      { when: { textMatches: "(cancel|iptal)" }, then: { kind: "genui", chunks: cancelChunks } },
    ]);
    await connector.sendMessage(out("please cancel my order"));
    vi.runAllTimers();
    expect(onMessage).not.toHaveBeenCalled();
    expect(onChunk).toHaveBeenCalledTimes(2);
    const [[streamA, chunkA, doneA], [streamB, chunkB, doneB]] = onChunk.mock.calls;
    expect(streamA).toBe(streamB);
    expect(chunkA).toEqual(cancelChunks[0]);
    expect(chunkB).toEqual(cancelChunks[1]);
    expect(doneA).toBe(false);
    expect(doneB).toBe(true);
  });

  it("uses a new stream id for every GenUI emission", async () => {
    const { connector, onChunk } = await setup([
      { when: { textMatches: "cancel" }, then: { kind: "genui", chunks: cancelChunks } },
    ]);
    await connector.sendMessage(out("cancel"));
    await connector.sendMessage(out("cancel"));
    vi.runAllTimers();
    const streams = new Set(onChunk.mock.calls.map(([s]) => s));
    expect(streams.size).toBe(2);
  });

  it("skips a GenUI rule when no chunk handler is registered", async () => {
    const connector = new DummyConnector({
      replyDelay: 0,
      connectDelay: 0,
      rules: [{ when: { textMatches: "cancel" }, then: { kind: "genui", chunks: cancelChunks } }],
    });
    const onMessage = vi.fn();
    connector.onMessage(onMessage);
    await connector.sendMessage(out("cancel"));
    vi.runAllTimers();
    expect(onMessage.mock.calls[0][0].data.text).toBe("Echo: cancel");
  });

  it("skips a rule with an invalid regex and warns instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rules: DummyRule[] = [
      { when: { textMatches: "([unclosed" }, then: { id: "bad", type: "text", data: { text: "bad" } } },
      { when: { textMatches: "unclosed" }, then: { id: "good", type: "text", data: { text: "good" } } },
    ];
    let connector!: DummyConnector;
    expect(() => {
      connector = new DummyConnector({ replyDelay: 0, connectDelay: 0, rules });
    }).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain("rule #0");

    const onMessage = vi.fn();
    connector.onMessage(onMessage);
    await connector.sendMessage(out("([unclosed"));
    vi.runAllTimers();
    expect(onMessage.mock.calls[0][0].data.text).toBe("good");
  });

  it("keeps /disconnect working ahead of rules", async () => {
    const { connector, onMessage } = await setup([
      { when: {}, then: { id: "all", type: "text", data: { text: "catch-all" } } },
    ]);
    const onDisconnect = vi.fn();
    connector.onDisconnect(onDisconnect);
    await connector.sendMessage(out("/disconnect"));
    vi.runAllTimers();
    expect(onDisconnect).toHaveBeenCalledWith("user");
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("keeps the demo helpers working alongside rules", async () => {
    const { connector, onMessage, onChunk } = await setup([
      { when: {}, then: { id: "all", type: "text", data: { text: "catch-all" } } },
    ]);
    connector.injectMessage({ type: "text", data: { text: "injected" } });
    connector.triggerGenUI("weather");
    vi.runAllTimers();
    expect(onMessage.mock.calls[0][0].data.text).toBe("injected");
    expect(onChunk).toHaveBeenCalled();
  });
});
