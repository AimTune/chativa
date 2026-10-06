import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketConnector } from "../WebSocketConnector";
import type { IncomingMessage } from "@chativa/core";

/** WebSocket stub that lets tests drive open/error/close transitions by hand. */
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  url: string;
  protocols: string | string[] | undefined;
  closeCalls = 0;
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
    this.closeCalls++;
    this.readyState = MockWebSocket.CLOSED;
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  /** Simulate the server dropping the connection. */
  drop(reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ reason });
  }
}

const latest = () => MockWebSocket.instances[MockWebSocket.instances.length - 1];

describe("WebSocketConnector lifecycle", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("exposes its name and adds sent messages to history", () => {
    const connector = new WebSocketConnector({ url: "ws://test" });
    expect(connector.name).toBe("websocket");
    expect(connector.addSentToHistory).toBe(true);
  });

  it("opens the socket with the configured url and protocols", async () => {
    const connector = new WebSocketConnector({ url: "ws://test", protocols: ["v1", "v2"] });
    const p = connector.connect();
    latest().open();
    await p;

    expect(latest().url).toBe("ws://test");
    expect(latest().protocols).toEqual(["v1", "v2"]);
  });

  it("defaults protocols to an empty list", async () => {
    const connector = new WebSocketConnector({ url: "ws://test" });
    const p = connector.connect();
    latest().open();
    await p;

    expect(latest().protocols).toEqual([]);
  });

  it("resolves connect and fires onConnect when the socket opens", async () => {
    const connector = new WebSocketConnector({ url: "ws://test" });
    const onConnect = vi.fn();
    connector.onConnect(onConnect);

    const p = connector.connect();
    expect(onConnect).not.toHaveBeenCalled();
    latest().open();
    await expect(p).resolves.toBeUndefined();
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("connects fine without any handlers registered", async () => {
    const connector = new WebSocketConnector({ url: "ws://test", reconnect: false });
    const p = connector.connect();
    const ws = latest();
    ws.open();
    await p;

    // Every inbound path with no handler attached must be a silent no-op.
    expect(() => {
      ws.onmessage?.({ data: JSON.stringify({ id: "m", type: "text", data: { text: "x" } }) });
      ws.onmessage?.({ data: "not json" });
      ws.onmessage?.({ data: JSON.stringify({ type: "typing", isTyping: true }) });
      ws.onmessage?.({ data: JSON.stringify({ type: "tool_call", data: { id: "c", name: "n", status: "running" } }) });
      ws.onmessage?.({
        data: JSON.stringify({ type: "genui", streamId: "s", chunk: { type: "text", content: "x" }, done: true }),
      });
      ws.onmessage?.({
        data: JSON.stringify({ type: "text", from: "bot", data: { text: "?" }, actions: [{ label: "A" }] }),
      });
      ws.drop("bye");
    }).not.toThrow();
  });

  it("rejects connect when the socket errors before opening", async () => {
    const connector = new WebSocketConnector({ url: "ws://test", reconnect: false });
    const p = connector.connect();
    latest().onerror?.({ type: "error" });

    await expect(p).rejects.toThrow('WebSocket error: {"type":"error"}');
  });

  it("closes the socket on disconnect and is then not connected", async () => {
    const connector = new WebSocketConnector({ url: "ws://test", reconnect: false });
    const p = connector.connect();
    const ws = latest();
    ws.open();
    await p;

    await connector.disconnect();
    expect(ws.closeCalls).toBe(1);
    await expect(connector.sendMessage({ id: "1", type: "text", data: { text: "x" } })).rejects.toThrow(
      "WebSocketConnector: not connected.",
    );
  });

  it("does not reconnect after a user-initiated disconnect", async () => {
    vi.useFakeTimers();
    const connector = new WebSocketConnector({ url: "ws://test" });
    const p = connector.connect();
    const ws = latest();
    ws.open();
    await p;

    await connector.disconnect();
    // A real browser fires `close` on the old socket after close().
    ws.drop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("cancels a pending reconnect when disconnect() is called during the delay", async () => {
    vi.useFakeTimers();
    const connector = new WebSocketConnector({ url: "ws://test" });
    const p = connector.connect();
    latest().open();
    await p;

    latest().drop("server restart"); // schedules a reconnect
    await connector.disconnect();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("does not leak an unhandled rejection when a reconnect attempt fails", async () => {
    vi.useFakeTimers();
    const unhandled = vi.fn();
    // Typed locally: this package has no @types/node.
    const proc = (globalThis as unknown as {
      process: { on(e: string, f: () => void): void; off(e: string, f: () => void): void };
    }).process;
    proc.on("unhandledRejection", unhandled);
    try {
      const connector = new WebSocketConnector({ url: "ws://test", maxReconnectAttempts: 1 });
      const p = connector.connect();
      latest().open();
      await p;

      latest().drop();
      await vi.advanceTimersByTimeAsync(2000);
      expect(MockWebSocket.instances).toHaveLength(2);
      latest().onerror?.({ type: "error" });
      await vi.advanceTimersByTimeAsync(0);
      vi.useRealTimers();
      await new Promise((r) => setTimeout(r, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      proc.off("unhandledRejection", unhandled);
    }
  });

  it("disconnect before connect is a no-op", async () => {
    const connector = new WebSocketConnector({ url: "ws://test" });
    await expect(connector.disconnect()).resolves.toBeUndefined();
  });

  it("swallows a GenUI component event before connect", () => {
    const connector = new WebSocketConnector({ url: "ws://test" });
    expect(() => connector.receiveComponentEvent("s", "e", {})).not.toThrow();
  });

  it("forwards GenUI event routing options in the genui_event frame", async () => {
    const connector = new WebSocketConnector({ url: "ws://test", reconnect: false });
    const p = connector.connect();
    const ws = latest();
    ws.open();
    await p;

    connector.receiveComponentEvent("s1", "click", { a: 1 }, { scope: "graph", component: "btn" });
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: "genui_event",
      streamId: "s1",
      eventType: "click",
      payload: { a: 1 },
      scope: "graph",
      component: "btn",
    });
  });
});

describe("WebSocketConnector sending", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function open() {
    const connector = new WebSocketConnector({ url: "ws://test", reconnect: false });
    const p = connector.connect();
    const ws = latest();
    ws.open();
    await p;
    return { connector, ws };
  }

  it("serialises an outgoing message as JSON", async () => {
    const { connector, ws } = await open();
    await connector.sendMessage({ id: "u1", type: "text", data: { text: "hello" }, timestamp: 5 });

    expect(JSON.parse(ws.sent[0])).toEqual({ id: "u1", type: "text", data: { text: "hello" }, timestamp: 5 });
  });

  it("throws when sending before connect", async () => {
    const connector = new WebSocketConnector({ url: "ws://test" });
    await expect(connector.sendMessage({ id: "1", type: "text", data: { text: "x" } })).rejects.toThrow(
      "WebSocketConnector: not connected.",
    );
  });

  it("throws when the socket is not open yet", async () => {
    const connector = new WebSocketConnector({ url: "ws://test", reconnect: false });
    void connector.connect();
    // Socket created but still CONNECTING.
    await expect(connector.sendMessage({ id: "1", type: "text", data: { text: "x" } })).rejects.toThrow(
      "not connected",
    );
  });

  it("sends a survey as a `survey` frame", async () => {
    const { connector, ws } = await open();
    await connector.sendSurvey({ rating: 4, comment: "nice", kind: "bot" });

    expect(JSON.parse(ws.sent[0])).toEqual({ type: "survey", rating: 4, comment: "nice", kind: "bot" });
  });

  it("throws when sending a survey before connect", async () => {
    const connector = new WebSocketConnector({ url: "ws://test" });
    await expect(connector.sendSurvey({ rating: 1 })).rejects.toThrow("WebSocketConnector: not connected.");
  });

  it("throws when sending a survey on a closed socket", async () => {
    const { connector, ws } = await open();
    ws.readyState = MockWebSocket.CLOSED;
    await expect(connector.sendSurvey({ rating: 1 })).rejects.toThrow("not connected");
    expect(ws.sent).toHaveLength(0);
  });
});

describe("WebSocketConnector inbound mapping", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function open() {
    const connector = new WebSocketConnector({ url: "ws://test", reconnect: false });
    const messages: IncomingMessage[] = [];
    connector.onMessage((m) => messages.push(m));
    const p = connector.connect();
    const ws = latest();
    ws.open();
    await p;
    return { connector, ws, messages };
  }

  it("stamps the non-JSON fallback message with a ws- id and the current time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_234_567);
    const { ws, messages } = await open();
    ws.onmessage?.({ data: "{broken" });

    expect(messages).toEqual([
      { id: "ws-1234567", type: "text", data: { text: "{broken" }, timestamp: 1_234_567 },
    ]);
  });

  it("swallows genui_components frames instead of rendering a bubble", async () => {
    const { ws, messages } = await open();
    ws.onmessage?.({
      data: JSON.stringify({ type: "genui_components", components: [{ name: "x", template: "<b></b>" }] }),
    });

    expect(messages).toHaveLength(0);
  });

  it("only the most recently registered message handler receives messages", async () => {
    const { connector, ws, messages } = await open();
    const second: IncomingMessage[] = [];
    connector.onMessage((m) => second.push(m));
    ws.onmessage?.({ data: JSON.stringify({ id: "a", type: "text", data: { text: "a" } }) });

    expect(messages).toHaveLength(0);
    expect(second).toHaveLength(1);
  });
});

describe("WebSocketConnector reconnect", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports the close reason through onDisconnect", async () => {
    const connector = new WebSocketConnector({ url: "ws://test", reconnect: false });
    const onDisconnect = vi.fn();
    connector.onDisconnect(onDisconnect);
    const p = connector.connect();
    latest().open();
    await p;

    latest().drop("server going away");
    expect(onDisconnect).toHaveBeenCalledWith("server going away");
  });

  it("does not reconnect when reconnect is disabled", async () => {
    const connector = new WebSocketConnector({ url: "ws://test", reconnect: false });
    const p = connector.connect();
    latest().open();
    await p;

    latest().drop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("reconnects after reconnectDelay when the socket drops", async () => {
    const connector = new WebSocketConnector({ url: "ws://test", reconnectDelay: 500 });
    const onConnect = vi.fn();
    connector.onConnect(onConnect);
    const p = connector.connect();
    latest().open();
    await p;

    latest().drop();
    await vi.advanceTimersByTimeAsync(499);
    expect(MockWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(MockWebSocket.instances).toHaveLength(2);

    latest().open();
    expect(onConnect).toHaveBeenCalledTimes(2);
  });

  it("uses a 2000ms default reconnect delay", async () => {
    const connector = new WebSocketConnector({ url: "ws://test" });
    const p = connector.connect();
    latest().open();
    await p;

    latest().drop();
    await vi.advanceTimersByTimeAsync(1999);
    expect(MockWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it("gives up after maxReconnectAttempts consecutive failures", async () => {
    const connector = new WebSocketConnector({
      url: "ws://test",
      reconnectDelay: 100,
      maxReconnectAttempts: 3,
    });
    const onDisconnect = vi.fn();
    connector.onDisconnect(onDisconnect);
    const p = connector.connect();
    latest().open();
    await p;

    // Initial drop + 3 reconnect sockets that each close without opening.
    for (let i = 0; i < 4; i++) {
      latest().drop(`drop-${i}`);
      await vi.advanceTimersByTimeAsync(100);
    }

    // 1 original + 3 retries, and no 5th socket however long we wait.
    expect(MockWebSocket.instances).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(MockWebSocket.instances).toHaveLength(4);
    expect(onDisconnect).toHaveBeenCalledTimes(4);
  });

  it("resets the attempt counter after a successful reconnect", async () => {
    const connector = new WebSocketConnector({
      url: "ws://test",
      reconnectDelay: 100,
      maxReconnectAttempts: 1,
    });
    const p = connector.connect();
    latest().open();
    await p;

    // Drop → one retry allowed → retry opens, resetting the budget.
    latest().drop();
    await vi.advanceTimersByTimeAsync(100);
    expect(MockWebSocket.instances).toHaveLength(2);
    latest().open();

    // A later drop gets a fresh retry.
    latest().drop();
    await vi.advanceTimersByTimeAsync(100);
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it("routes messages from the reconnected socket to the same handlers", async () => {
    const connector = new WebSocketConnector({ url: "ws://test", reconnectDelay: 10 });
    const messages: IncomingMessage[] = [];
    connector.onMessage((m) => messages.push(m));
    const p = connector.connect();
    latest().open();
    await p;

    latest().drop();
    await vi.advanceTimersByTimeAsync(10);
    const ws2 = latest();
    ws2.open();
    ws2.onmessage?.({ data: JSON.stringify({ id: "r", type: "text", data: { text: "back" } }) });

    expect(messages).toEqual([{ id: "r", type: "text", data: { text: "back" } }]);
    await connector.sendMessage({ id: "u", type: "text", data: { text: "hi" } });
    expect(ws2.sent).toHaveLength(1);
  });
});
