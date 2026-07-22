import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketConnector } from "../WebSocketConnector";
import type { ToolCall, AIChunk, IncomingMessage } from "@chativa/core";

/** Minimal WebSocket stub — tests drive open/message transitions by hand. */
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { reason: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
}

/** A connected connector plus everything its handlers saw. */
async function connected() {
  const connector = new WebSocketConnector({ url: "ws://test", reconnect: false });
  const messages: IncomingMessage[] = [];
  const toolCalls: ToolCall[] = [];
  const genui: Array<{ streamId: string; chunk: AIChunk; done: boolean }> = [];
  const typing: boolean[] = [];
  connector.onMessage((m) => messages.push(m));
  connector.onToolCall((tc) => toolCalls.push(tc));
  connector.onGenUIChunk((streamId, chunk, done) => genui.push({ streamId, chunk, done }));
  connector.onTyping((t) => typing.push(t));

  const p = connector.connect();
  const ws = MockWebSocket.instances[0];
  ws.open();
  await p;

  const receive = (frame: unknown) => ws.onmessage?.({ data: JSON.stringify(frame) });
  return { connector, ws, receive, messages, toolCalls, genui, typing };
}

describe("WebSocketConnector frame routing", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes tool_call frames to onToolCall, not onMessage", async () => {
    const { receive, toolCalls, messages } = await connected();
    receive({ type: "tool_call", data: { id: "c1", name: "get_weather", status: "running" } });

    expect(toolCalls).toEqual([{ id: "c1", name: "get_weather", status: "running" }]);
    expect(messages).toHaveLength(0);
  });

  it("routes genui frames to onGenUIChunk, not onMessage", async () => {
    const { receive, genui, messages } = await connected();
    receive({
      type: "genui",
      streamId: "s1",
      chunk: { type: "ui", component: "weather", props: { city: "Izmir" }, id: 1 },
      done: true,
    });

    expect(genui).toEqual([
      { streamId: "s1", chunk: { type: "ui", component: "weather", props: { city: "Izmir" }, id: 1 }, done: true },
    ]);
    expect(messages).toHaveLength(0);
  });

  it("routes typing frames to onTyping", async () => {
    const { receive, typing, messages } = await connected();
    receive({ type: "typing", isTyping: true });
    receive({ type: "typing", isTyping: false });

    expect(typing).toEqual([true, false]);
    expect(messages).toHaveLength(0);
  });

  it("surfaces a bot text frame with actions as a quick-reply (HITL chips)", async () => {
    const { receive, messages } = await connected();
    receive({
      type: "text",
      id: "m1",
      from: "bot",
      data: { text: "Deploy?" },
      actions: [{ label: "Approve" }],
      timestamp: 1700,
    });

    expect(messages).toEqual([
      {
        id: "m1",
        type: "quick-reply",
        data: { text: "Deploy?", actions: [{ label: "Approve" }], keepActions: true },
        timestamp: 1700,
      },
    ]);
  });

  it("still passes a plain message straight through to onMessage", async () => {
    const { receive, messages } = await connected();
    receive({ id: "m2", type: "text", data: { text: "hello" } });

    expect(messages).toEqual([{ id: "m2", type: "text", data: { text: "hello" } }]);
  });

  it("falls back to a text message for a non-JSON payload", async () => {
    const { ws, messages } = await connected();
    ws.onmessage?.({ data: "plain text" });

    expect(messages[0]).toMatchObject({ type: "text", data: { text: "plain text" } });
  });

  it("sends a GenUI component event back as a genui_event frame", async () => {
    const { connector, ws } = await connected();
    connector.receiveComponentEvent("s1", "form_submit", { answer: 42 });

    expect(JSON.parse(ws.sent[ws.sent.length - 1])).toEqual({
      type: "genui_event",
      streamId: "s1",
      eventType: "form_submit",
      payload: { answer: 42 },
    });
  });

  it("drops a GenUI component event instead of throwing when the socket is down", async () => {
    const { connector, ws } = await connected();
    ws.readyState = MockWebSocket.CLOSED;

    expect(() => connector.receiveComponentEvent("s1", "x", {})).not.toThrow();
  });
});
