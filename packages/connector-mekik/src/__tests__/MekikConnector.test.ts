import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MekikConnector, CookieAuth, TokenAuth } from "../index";
import type { MekikAuthProvider } from "../index";
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
  const connector = new MekikConnector({ url: "ws://test", reconnect: false });
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

describe("MekikConnector.routeFrame", () => {
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
    const connector = new MekikConnector({
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
    const connector = new MekikConnector({
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
    const connector = new MekikConnector({
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

/**
 * Wait for the connector to create its Nth socket. With an auth provider the
 * credential is resolved before the socket exists, so it appears a microtask
 * later than it does on the anonymous path — polling covers both without the
 * test having to know how many microtasks a given provider costs.
 */
async function socketAt(index: number): Promise<MockWebSocket> {
  for (let i = 0; i < 50 && !MockWebSocket.instances[index]; i++) {
    await Promise.resolve();
  }
  const ws = MockWebSocket.instances[index];
  if (!ws) throw new Error(`no socket was created at index ${index}`);
  return ws;
}

/** Let any pending microtask chain (provider → decision → reconnect) settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

/** The `token` field of the hello frame a socket sent. */
function helloToken(ws: MockWebSocket): string | undefined {
  return (JSON.parse(ws.sent[0]) as { token?: string }).token;
}

/** Simulate the server rejecting auth: an `error` frame, then the close. */
function rejectAuth(ws: MockWebSocket, message = "invalid token"): void {
  ws.onmessage?.({
    data: JSON.stringify({ type: "error", data: { code: "unauthorized", message } }),
  });
}

describe("MekikConnector socket lifecycle", () => {
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
    const connector = new MekikConnector({ url: "ws://test", reconnectDelay: 10 });
    const p = connector.connect();
    MockWebSocket.instances[0].open();
    await p;

    MockWebSocket.instances[0].serverClose(); // schedules reconnect at +10ms
    await connector.disconnect();
    vi.advanceTimersByTime(1000);

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("auto-reconnect survives a disconnect/connect cycle (options not mutated)", async () => {
    const connector = new MekikConnector({ url: "ws://test", reconnectDelay: 10 });
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
    const connector = new MekikConnector({ url: "ws://test", reconnect: false });
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
    const connector = new MekikConnector({ url: "ws://test", reconnect: false });
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
    const connector = new MekikConnector({ url: "ws://test", reconnect: false });
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
    const connector = new MekikConnector({ url: "ws://test", token: "tok-123", reconnect: false });
    const p = connector.connect();
    const ws = await socketAt(0);
    ws.open();
    await p;

    const hello = JSON.parse(ws.sent[0]) as Record<string, unknown>;
    expect(hello).toMatchObject({ type: "hello", token: "tok-123" });
  });

  it("resolves a function token freshly on every connect", async () => {
    let n = 0;
    const connector = new MekikConnector({
      url: "ws://test",
      token: () => `tok-${++n}`,
      reconnect: false,
    });

    const p1 = connector.connect();
    (await socketAt(0)).open();
    await p1;
    expect(helloToken(MockWebSocket.instances[0])).toBe("tok-1");

    await connector.disconnect();
    const p2 = connector.connect();
    (await socketAt(1)).open();
    await p2;
    expect(helloToken(MockWebSocket.instances[1])).toBe("tok-2");
  });

  it("legacy `token` still works and never retries a rejection", async () => {
    // The pre-`auth` spelling desugars to TokenAuth({ maxRetries: 0 }) — apps
    // written against it must not suddenly gain retry behaviour.
    let n = 0;
    const connector = new MekikConnector({
      url: "ws://test",
      token: () => `legacy-${++n}`,
      reconnect: false,
    });
    const p = connector.connect();
    const ws = await socketAt(0);
    ws.open();
    await p;
    expect(helloToken(ws)).toBe("legacy-1");

    rejectAuth(ws);
    await flush();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("does not auto-reconnect after an auth rejection", async () => {
    const connector = new MekikConnector({ url: "ws://test", reconnectDelay: 10 });
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

describe("MekikConnector auth providers", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("TokenAuth sends a static token in the hello frame by default", async () => {
    const connector = new MekikConnector({
      url: "ws://test",
      auth: new TokenAuth({ token: "api-key" }),
      reconnect: false,
    });
    const p = connector.connect();
    const ws = await socketAt(0);
    ws.open();
    await p;

    expect(helloToken(ws)).toBe("api-key");
    expect(ws.url).toBe("ws://test"); // credential stays out of the URL
  });

  it("TokenAuth transport 'query' puts the token in the socket URL, not the frame", async () => {
    // The only transport an edge proxy authenticating at the HTTP upgrade can
    // read — it never sees the hello frame.
    const connector = new MekikConnector({
      url: "ws://test/chat",
      auth: new TokenAuth({ token: "q-tok", transport: "query" }),
      reconnect: false,
    });
    const p = connector.connect();
    const ws = await socketAt(0);
    ws.open();
    await p;

    expect(ws.url).toContain("token=q-tok");
    expect(helloToken(ws)).toBeUndefined();
  });

  it("TokenAuth honours a custom query param name", async () => {
    const connector = new MekikConnector({
      url: "ws://test/chat?tenant=acme",
      auth: new TokenAuth({ token: "k", transport: "query", queryParam: "access_token" }),
      reconnect: false,
    });
    const p = connector.connect();
    const ws = await socketAt(0);
    ws.open();
    await p;

    expect(ws.url).toContain("access_token=k");
    expect(ws.url).toContain("tenant=acme"); // pre-existing query survives
  });

  it("TokenAuth re-mints a function token and retries once when rejected", async () => {
    let n = 0;
    const connector = new MekikConnector({
      url: "ws://test",
      auth: new TokenAuth({ token: () => `jwt-${++n}` }),
      reconnect: false,
    });
    const p = connector.connect();
    const first = await socketAt(0);
    first.open();
    await p;
    expect(helloToken(first)).toBe("jwt-1");

    rejectAuth(first, "expired");
    const second = await socketAt(1);
    second.open();
    await flush();

    // The retry carries a *different* credential — the whole point of retrying.
    expect(helloToken(second)).toBe("jwt-2");
  });

  it("TokenAuth stops after maxRetries instead of looping", async () => {
    let n = 0;
    const connector = new MekikConnector({
      url: "ws://test",
      auth: new TokenAuth({ token: () => `jwt-${++n}`, maxRetries: 1 }),
      reconnect: false,
    });
    const p = connector.connect();
    (await socketAt(0)).open();
    await p;

    rejectAuth(MockWebSocket.instances[0]);
    (await socketAt(1)).open();
    await flush();

    rejectAuth(MockWebSocket.instances[1]); // second rejection: give up
    await flush();
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it("TokenAuth never retries a static token", async () => {
    // Re-sending a string the server just refused cannot change the verdict.
    const connector = new MekikConnector({
      url: "ws://test",
      auth: new TokenAuth({ token: "static" }),
      reconnect: false,
    });
    const p = connector.connect();
    const ws = await socketAt(0);
    ws.open();
    await p;

    rejectAuth(ws);
    await flush();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("CookieAuth contributes no credential — the browser attaches the cookie", async () => {
    const connector = new MekikConnector({
      url: "ws://test",
      auth: new CookieAuth(),
      reconnect: false,
    });
    const p = connector.connect();
    const ws = await socketAt(0);
    ws.open();
    await p;

    expect(helloToken(ws)).toBeUndefined();
    expect(ws.url).toBe("ws://test");
  });

  it("CookieAuth refreshes an expired session once, then reconnects", async () => {
    let refreshed = 0;
    const connector = new MekikConnector({
      url: "ws://test",
      auth: new CookieAuth({ refresh: () => { refreshed++; } }),
      reconnect: false,
    });
    const p = connector.connect();
    const ws = await socketAt(0);
    ws.open();
    await p;

    rejectAuth(ws, "session expired");
    await socketAt(1);
    expect(refreshed).toBe(1);
  });

  it("CookieAuth gives up when the refresh itself fails", async () => {
    const connector = new MekikConnector({
      url: "ws://test",
      auth: new CookieAuth({ refresh: () => Promise.reject(new Error("refresh 500")) }),
      reconnect: false,
    });
    const p = connector.connect();
    const ws = await socketAt(0);
    ws.open();
    await p;

    rejectAuth(ws);
    await flush();
    expect(MockWebSocket.instances).toHaveLength(1); // no pointless reconnect
  });

  it("a provider that throws fails connect() instead of connecting anonymously", async () => {
    // Degrading to no credential would surface a token-endpoint outage as a
    // misleading "unauthorized" from the server.
    const broken: MekikAuthProvider = {
      name: "broken",
      authenticate: () => {
        throw new Error("token endpoint down");
      },
    };
    const connector = new MekikConnector({ url: "ws://test", auth: broken, reconnect: false });

    await expect(connector.connect()).rejects.toThrow("token endpoint down");
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("disconnect() during authenticate() leaves no zombie socket", async () => {
    let release!: (token: string) => void;
    const connector = new MekikConnector({
      url: "ws://test",
      auth: new TokenAuth({ token: () => new Promise<string>((r) => (release = r)) }),
      reconnect: false,
    });

    const p = connector.connect();
    await Promise.resolve();
    await connector.disconnect(); // shut down while the token is still in flight
    release("too-late");
    await p;

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("a second connect() during authenticate() supersedes the first", async () => {
    // Neither attempt is "closed by user", so only the generation guard can
    // tell the stale credential apart from the live one.
    const release: Array<(token: string) => void> = [];
    let n = 0;
    const connector = new MekikConnector({
      url: "ws://test",
      auth: new TokenAuth({
        token: () => {
          n++;
          return new Promise<string>((r) => release.push(r));
        },
      }),
      reconnect: false,
    });

    const p1 = connector.connect();
    await Promise.resolve();
    const p2 = connector.connect();
    await flush();
    expect(n).toBe(2); // both attempts asked for a credential

    release[0]("stale");
    release[1]("live");
    await flush();

    const ws = await socketAt(0);
    ws.open();
    await Promise.all([p1, p2]);

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(helloToken(ws)).toBe("live");
  });

  it("onAuthError still fires for a provider-driven rejection", async () => {
    const seen: string[] = [];
    const connector = new MekikConnector({
      url: "ws://test",
      auth: new TokenAuth({ token: "static" }),
      onAuthError: (e) => seen.push(e.code),
      reconnect: false,
    });
    const p = connector.connect();
    const ws = await socketAt(0);
    ws.open();
    await p;

    rejectAuth(ws);
    await flush();

    expect(seen).toEqual(["unauthorized"]);
    expect(connector.authError?.message).toBe("invalid token");
  });
});

describe("MekikConnector mekik/2 human-in-the-loop", () => {
  it("renders an interrupt frame as quick-reply chips and answers with a resume", () => {
    const { connector, messages, route } = makeConnector();
    route({
      type: "interrupt",
      seq: 5,
      id: "gate:interrupt#0",
      data: {
        payload: { title: "Refund 249.9?" },
        actions: [
          { label: "Approve", value: { approved: true } },
          { label: "Reject", value: { approved: false } },
        ],
      },
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("quick-reply");
    const data = messages[0].data as Record<string, unknown>;
    expect(data.text).toBe("Refund 249.9?");
    expect((data.actions as Array<{ label: string }>).map((a) => a.label)).toEqual([
      "Approve",
      "Reject",
    ]);

    // Tapping "Approve" resumes by the interrupt id with the structured answer.
    void connector.sendMessage({ type: "text", data: { text: "Approve" } } as never);
    const queue = (connector as unknown as { queue: Array<{ payload: string }> }).queue;
    expect(queue).toHaveLength(1);
    expect(JSON.parse(queue[0].payload)).toEqual({
      type: "resume",
      answers: { "gate:interrupt#0": { approved: true } },
    });
  });

  it("stops treating messages as resumes once interrupt_resolved arrives", () => {
    const { connector, route } = makeConnector();
    route({ type: "interrupt", id: "x:interrupt#0", data: { actions: [{ label: "OK", value: true }] } });
    route({ type: "interrupt_resolved", id: "x:interrupt#0", data: { answer: true } });

    void connector.sendMessage({ type: "text", data: { text: "OK" } } as never);
    const queue = (connector as unknown as { queue: Array<{ payload: string }> }).queue;
    expect(JSON.parse(queue[0].payload).type).not.toBe("resume");
  });

  it("re-renders open interrupts announced in welcome.pending", () => {
    const { messages, route } = makeConnector();
    route({
      type: "welcome",
      data: {
        conversationId: "c1",
        userId: "u1",
        connectionId: "cx",
        watermark: 3,
        pending: [
          { id: "gate:interrupt#0", data: { payload: { title: "Still pending?" }, actions: [{ label: "Yes" }] } },
        ],
      },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("quick-reply");
    expect((messages[0].data as Record<string, unknown>).text).toBe("Still pending?");
  });
});
