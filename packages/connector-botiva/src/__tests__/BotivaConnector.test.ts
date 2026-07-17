import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BotivaConnector } from "../index";
import type { ToolCall } from "@chativa/core";

/** Minimal WebSocket stub — tests drive open/close/message transitions by hand. */
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  url: string;
  protocols?: string | string[];
  onopen: (() => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { reason: string }) => void) | null = null;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    MockWebSocket.instances.push(this);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  /** Simulate the server accepting the connection. */
  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  /** Simulate an unexpected server-side close. */
  serverClose(reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ reason });
  }
}

/**
 * routeFrame() is exercised directly (no socket) — it is the single dispatch
 * point every wire frame goes through, so feeding it raw JSON is equivalent
 * to receiving the frame over any transport.
 */
function makeConnector() {
  const connector = new BotivaConnector({ url: "ws://test", reconnect: false });
  const messages: Array<Record<string, unknown>> = [];
  const toolCalls: ToolCall[] = [];
  connector.onMessage((m) => messages.push(m as unknown as Record<string, unknown>));
  connector.onToolCall((tc) => toolCalls.push(tc));
  const route = (frame: Record<string, unknown>) =>
    (connector as unknown as { routeFrame(raw: string): void }).routeFrame(
      JSON.stringify(frame),
    );
  return { connector, messages, toolCalls, route };
}

describe("BotivaConnector.routeFrame", () => {
  it("surfaces a bot text frame with actions as a quick-reply message", () => {
    const { messages, route } = makeConnector();
    route({
      type: "text",
      id: "msg-hitl",
      seq: 7,
      from: "bot",
      data: { text: 'Generate the "velocity" report as PDF?' },
      actions: [{ label: "Approve" }, { label: "Cancel" }],
      timestamp: 1234,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("quick-reply");
    expect(messages[0].id).toBe("msg-hitl");
    expect(messages[0].timestamp).toBe(1234);
    const data = messages[0].data as Record<string, unknown>;
    expect(data.text).toBe('Generate the "velocity" report as PDF?');
    expect(data.actions).toEqual([{ label: "Approve" }, { label: "Cancel" }]);
    expect(data.keepActions).toBe(true);
  });

  it("leaves a plain bot text frame untouched", () => {
    const { messages, route } = makeConnector();
    route({
      type: "text",
      id: "msg-plain",
      from: "bot",
      data: { text: "hello" },
      timestamp: 1,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("text");
  });

  it("does not remap replayed user frames even if they carry actions", () => {
    const { messages, route } = makeConnector();
    route({
      type: "text",
      id: "msg-user",
      from: "user",
      data: { text: "evet" },
      actions: [{ label: "stray" }],
      timestamp: 2,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("text");
  });

  it("routes tool_call frames to onToolCall, not onMessage", () => {
    const { messages, toolCalls, route } = makeConnector();
    route({
      type: "tool_call",
      seq: 3,
      data: { id: "t1", name: "generate_report_pdf", status: "running" },
    });
    expect(messages).toHaveLength(0);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]).toMatchObject({ id: "t1", status: "running" });
  });

  it("surfaces an auth error frame via onAuthError, not as a chat message", () => {
    const authErrors: Array<{ code: string; message: string }> = [];
    const connector = new BotivaConnector({
      url: "ws://test",
      reconnect: false,
      onAuthError: (e) => authErrors.push(e),
    });
    const messages: unknown[] = [];
    connector.onMessage((m) => messages.push(m));
    (connector as unknown as { routeFrame(raw: string): void }).routeFrame(
      JSON.stringify({ type: "error", data: { code: "unauthorized", message: "invalid token" } }),
    );

    expect(messages).toHaveLength(0);
    expect(authErrors).toEqual([{ code: "unauthorized", message: "invalid token" }]);
    expect(connector.authError).toEqual({ code: "unauthorized", message: "invalid token" });
  });

  it("welcome with a partial payload does not clobber configured identity", () => {
    const connector = new BotivaConnector({
      url: "ws://test",
      reconnect: false,
      userId: "alice",
      conversationId: "conv-1",
    });
    const route = (frame: Record<string, unknown>) =>
      (connector as unknown as { routeFrame(raw: string): void }).routeFrame(
        JSON.stringify(frame),
      );

    route({ type: "welcome" }); // no data at all

    const opts = (connector as unknown as {
      options: { userId?: string; conversationId?: string };
    }).options;
    expect(opts.userId).toBe("alice");
    expect(opts.conversationId).toBe("conv-1");
    expect(connector.identity?.userId).toBe("alice");
  });

  it("welcome assigning a different conversationId resets the watermark", () => {
    const connector = new BotivaConnector({
      url: "ws://test",
      reconnect: false,
      conversationId: "conv-old",
    });
    const internals = connector as unknown as {
      routeFrame(raw: string): void;
      watermark: number;
    };
    const route = (frame: Record<string, unknown>) =>
      internals.routeFrame(JSON.stringify(frame));

    route({ type: "text", seq: 42, from: "bot", data: { text: "old" } });
    expect(internals.watermark).toBe(42);

    // Same conversation → watermark survives.
    route({ type: "welcome", data: { conversationId: "conv-old", userId: "u" } });
    expect(internals.watermark).toBe(42);

    // Server minted a new conversation (old one expired) → replay window resets.
    route({ type: "welcome", data: { conversationId: "conv-new", userId: "u" } });
    expect(internals.watermark).toBe(0);
  });
});

describe("BotivaConnector socket lifecycle", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("disconnect() cancels a pending auto-reconnect (no zombie socket)", async () => {
    const connector = new BotivaConnector({ url: "ws://test", reconnectDelay: 10 });
    const p = connector.connect();
    MockWebSocket.instances[0].open();
    await p;

    MockWebSocket.instances[0].serverClose(); // schedules reconnect at +10ms
    await connector.disconnect();
    vi.advanceTimersByTime(1000);

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("auto-reconnect survives a disconnect/connect cycle (options not mutated)", async () => {
    const connector = new BotivaConnector({ url: "ws://test", reconnectDelay: 10 });
    const p1 = connector.connect();
    MockWebSocket.instances[0].open();
    await p1;
    await connector.disconnect();

    const p2 = connector.connect();
    MockWebSocket.instances[1].open();
    await p2;

    MockWebSocket.instances[1].serverClose();
    vi.advanceTimersByTime(10);
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it("a second connect() detaches the previous socket — only one routes frames", async () => {
    const connector = new BotivaConnector({ url: "ws://test", reconnect: false });
    const received: unknown[] = [];
    connector.onMessage((m) => received.push(m));

    void connector.connect().catch(() => {});
    const first = MockWebSocket.instances[0];
    const p2 = connector.connect();
    const second = MockWebSocket.instances[1];

    expect(first.onmessage).toBeNull();
    expect(first.readyState).toBe(MockWebSocket.CLOSED);

    second.open();
    await p2;
    second.onmessage?.({
      data: JSON.stringify({ type: "text", from: "bot", data: { text: "hi" }, id: "m1" }),
    });
    expect(received).toHaveLength(1);
  });

  it("queued sends resolve only when actually flushed on (re)connect", async () => {
    const connector = new BotivaConnector({ url: "ws://test", reconnect: false });
    let resolved = false;
    const sendP = connector
      .sendMessage({ id: "m1", type: "text", data: { text: "offline" } })
      .then(() => {
        resolved = true;
      });

    await Promise.resolve();
    expect(resolved).toBe(false); // still queued — no socket yet

    const p = connector.connect();
    const ws = MockWebSocket.instances[0];
    ws.open();
    await p;
    await sendP;

    expect(resolved).toBe(true);
    expect(ws.sent.some((f) => f.includes('"offline"'))).toBe(true);
  });

  it("forwards GenUI component events as genui_event frames", async () => {
    const connector = new BotivaConnector({ url: "ws://test", reconnect: false });
    const p = connector.connect();
    const ws = MockWebSocket.instances[0];
    ws.open();
    await p;

    connector.receiveComponentEvent("s1", "form_submit", { answer: 42 });

    const frame = JSON.parse(ws.sent[ws.sent.length - 1]) as Record<string, unknown>;
    expect(frame).toMatchObject({
      type: "genui_event",
      streamId: "s1",
      eventType: "form_submit",
      payload: { answer: 42 },
    });
  });

  it("sends a static token in the hello handshake", async () => {
    const connector = new BotivaConnector({ url: "ws://test", token: "tok-123", reconnect: false });
    const p = connector.connect();
    const ws = MockWebSocket.instances[0];
    ws.open();
    await p;

    const hello = JSON.parse(ws.sent[0]) as Record<string, unknown>;
    expect(hello).toMatchObject({ type: "hello", token: "tok-123" });
  });

  it("resolves a function token freshly on every connect", async () => {
    let n = 0;
    const connector = new BotivaConnector({
      url: "ws://test",
      token: () => `tok-${++n}`,
      reconnect: false,
    });

    const p1 = connector.connect();
    MockWebSocket.instances[0].open();
    await p1;
    expect((JSON.parse(MockWebSocket.instances[0].sent[0]) as { token: string }).token).toBe("tok-1");

    await connector.disconnect();
    const p2 = connector.connect();
    MockWebSocket.instances[1].open();
    await p2;
    expect((JSON.parse(MockWebSocket.instances[1].sent[0]) as { token: string }).token).toBe("tok-2");
  });

  it("does not auto-reconnect after an auth rejection", async () => {
    const connector = new BotivaConnector({ url: "ws://test", reconnectDelay: 10 });
    const p = connector.connect();
    const ws = MockWebSocket.instances[0];
    ws.open();
    await p;

    // Server rejects: an error frame, then the socket closes.
    ws.onmessage?.({
      data: JSON.stringify({ type: "error", data: { code: "unauthorized", message: "no" } }),
    });
    ws.serverClose();
    vi.advanceTimersByTime(1000);

    expect(MockWebSocket.instances).toHaveLength(1); // no reconnect attempt
  });
});
