import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChativaContext, Conversation, IncomingMessage, MessageStatus } from "@chativa/core";
import { ConvergerConnector, ConvergerApiError, TokenAuth, MekikConnector } from "../index";
import type { ConvergerConnectorOptions } from "../index";

// ── Test doubles ───────────────────────────────────────────────────────

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
  onclose: ((ev: { reason: string; code?: number }) => void) | null = null;

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

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  serverClose(reason = "", code = 1006): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ reason, code });
  }

  receive(frame: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  frames(): Array<Record<string, unknown>> {
    return this.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
  }

  last(): Record<string, unknown> {
    return JSON.parse(this.sent[this.sent.length - 1]) as Record<string, unknown>;
  }
}

interface Call {
  method: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

type Handler = (call: Call) => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A fetch double routing on "METHOD /path" (path relative to the API base). */
function mockFetch(routes: Record<string, Handler | unknown>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    const call: Call = { method, url, headers: new Headers(init.headers), body: init.body };
    calls.push(call);
    const path = url.pathname.replace(/^\/api\/v1\/converger/, "");
    const route = routes[`${method} ${path}`];
    if (route === undefined) return json({ error: { code: "not_found", message: `${method} ${path}` } }, 404);
    if (route instanceof Response) return route.clone();
    return typeof route === "function" ? (route as Handler)(call) : json(route);
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

/** Let promise chains (auth, fetch, Response.json) settle without touching timers. */
async function flush(): Promise<void> {
  // setImmediate is never faked by the tests (they fake timeouts and intervals
  // only); the workspace has no @types/node, hence the cast.
  const { setImmediate } = globalThis as unknown as { setImmediate(cb: () => void): void };
  for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => setImmediate(resolve));
}

const WELCOME = (conversationId = "conv-1", extra: Record<string, unknown> = {}) => ({
  type: "welcome",
  data: {
    protocol: "converger/1",
    conversationId,
    userId: "user-42",
    connectionId: "c1",
    watermark: 0,
    capabilities: { acks: true, receipts: true },
    limits: { idleTimeoutMs: 60_000 },
    ...extra,
  },
});

function make(options: Partial<ConvergerConnectorOptions> = {}) {
  const connector = new ConvergerConnector({
    url: "ws://hub.test/socket/converger/v1",
    auth: new TokenAuth({ token: "tok" }),
    reconnect: false,
    ...options,
  });
  const messages: IncomingMessage[] = [];
  const statuses: Array<[string, MessageStatus]> = [];
  const conversations: Conversation[] = [];
  connector.onMessage((m) => messages.push(m));
  connector.onMessageStatus((id, s) => statuses.push([id, s]));
  connector.onConversationUpdate((c) => conversations.push(c));
  return { connector, messages, statuses, conversations };
}

/** connect() and complete the handshake; returns the live socket. */
async function open(connector: ConvergerConnector, welcome: Record<string, unknown> = WELCOME()) {
  const before = MockWebSocket.instances.length;
  const done = connector.connect();
  await flush();
  const ws = MockWebSocket.instances[before];
  expect(ws).toBeDefined();
  ws.open();
  await done;
  ws.receive(welcome);
  return ws;
}

function fakeContext(opened = true) {
  const handlers: Record<string, () => void> = {};
  const ctx = {
    messages: { add: vi.fn(), update: vi.fn(), remove: vi.fn(), clear: vi.fn(), getAll: vi.fn(() => []) },
    chat: {
      open: vi.fn(),
      close: vi.fn(),
      toggle: vi.fn(),
      setTyping: vi.fn(),
      setFullscreen: vi.fn(),
      getStatus: vi.fn(),
      isOpened: vi.fn(() => opened),
    },
    theme: { get: vi.fn(), set: vi.fn() },
    events: {
      on: vi.fn((event: string, handler: () => void) => {
        handlers[event] = handler;
      }),
      off: vi.fn(),
      emit: vi.fn(),
    },
  };
  return { ctx: ctx as unknown as ChativaContext, raw: ctx, handlers };
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
  mockFetch({});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Construction and handshake ─────────────────────────────────────────

describe("ConvergerConnector — setup", () => {
  it("is a MekikConnector named converger", () => {
    const { connector } = make();
    expect(connector).toBeInstanceOf(MekikConnector);
    expect(connector.name).toBe("converger");
  });

  it("derives the REST base from the socket URL", () => {
    expect(make().connector.apiUrl).toBe("http://hub.test/api/v1/converger");
    expect(make({ url: "wss://hub.test:8443/socket/converger/v1?x=1" }).connector.apiUrl).toBe(
      "https://hub.test:8443/api/v1/converger",
    );
    expect(make({ apiUrl: "https://api.test/v1/converger/" }).connector.apiUrl).toBe(
      "https://api.test/v1/converger",
    );
  });

  it("offers the converger.v1 subprotocol and names converger/1 in hello", async () => {
    const { connector } = make();
    const ws = await open(connector);
    expect(ws.protocols).toEqual(["converger.v1"]);
    const hello = ws.frames()[0];
    expect(hello).toMatchObject({ type: "hello", protocol: "converger/1", token: "tok" });
  });

  it("keeps protocols the app passes", async () => {
    const { connector } = make({ protocols: ["converger.v1+json"] });
    const ws = await open(connector);
    expect(ws.protocols).toEqual(["converger.v1+json"]);
  });

  it("accepts the legacy `token` option", async () => {
    const { connector } = make({ auth: undefined, token: "legacy" });
    const ws = await open(connector);
    expect(ws.frames()[0].token).toBe("legacy");
  });

  it("sends ping frames at half the idle timeout and stops on disconnect", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
    const { connector } = make();
    const ws = await open(connector, WELCOME("conv-1", { limits: { idleTimeoutMs: 1000 } }));
    vi.advanceTimersByTime(500);
    expect(ws.last()).toEqual({ type: "ping" });
    const count = ws.sent.length;
    await connector.disconnect();
    vi.advanceTimersByTime(5000);
    expect(ws.sent.length).toBe(count);
  });

  it("uses a 30 s ping interval when welcome has no limits", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
    const { connector } = make();
    const ws = await open(connector, { type: "welcome", data: { conversationId: "conv-1", capabilities: { acks: true } } });
    vi.advanceTimersByTime(29_999);
    expect(ws.sent.some((s) => s.includes("ping"))).toBe(false);
    vi.advanceTimersByTime(1);
    expect(ws.last()).toEqual({ type: "ping" });
    await connector.disconnect();
  });

  it("swallows Converger-only frames that are not chat bubbles", async () => {
    const { connector, messages } = make();
    const ws = await open(connector);
    for (const type of ["heartbeat", "presence", "tokenRefreshed", "replayTruncated", "event"]) {
      ws.receive({ type, data: {} });
    }
    expect(messages).toEqual([]);
  });

  it("lets mekik frames through untouched", async () => {
    const { connector, messages } = make();
    const ws = await open(connector);
    ws.receive({ type: "text", id: "b1", seq: 1, from: "bot", data: { text: "hi" }, timestamp: 5 });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ id: "b1", type: "text", data: { text: "hi" } });
  });
});

// ── Sends, acks and errors ─────────────────────────────────────────────

describe("ConvergerConnector — clientId and acks", () => {
  const msg = (id = "m-1", text = "hello") => ({ id, type: "text", data: { text }, timestamp: 1 });

  it("sends a clientId and resolves on the ack", async () => {
    const { connector, statuses } = make();
    const ws = await open(connector);
    let done = false;
    const sending = connector.sendMessage(msg()).then(() => (done = true));
    await flush();
    expect(ws.last()).toMatchObject({ type: "text", id: "m-1", clientId: "m-1", data: { text: "hello" } });
    expect(done).toBe(false);
    ws.receive({ type: "ack", clientId: "m-1", id: "act-1", seq: 3, timestamp: 9 });
    await sending;
    expect(statuses).toEqual([["m-1", "sent"]]);
  });

  it("ignores an ack without a clientId or for an unknown one", async () => {
    const { connector, statuses } = make();
    const ws = await open(connector);
    ws.receive({ type: "ack" });
    ws.receive({ type: "ack", clientId: "nobody" });
    expect(statuses).toEqual([["nobody", "sent"]]);
  });

  it("maps deliveryStatus by activity id onto the chativa id, forward only", async () => {
    const { connector, statuses } = make();
    const ws = await open(connector);
    const sending = connector.sendMessage(msg());
    await flush();
    ws.receive({ type: "ack", clientId: "m-1", id: "act-1", seq: 3 });
    await sending;
    ws.receive({ type: "deliveryStatus", data: { activityId: "act-1", seq: 3, status: "queued" } });
    ws.receive({ type: "deliveryStatus", data: { activityId: "act-1", seq: 3, status: "delivered" } });
    ws.receive({ type: "deliveryStatus", data: { activityId: "act-1", seq: 3, status: "read" } });
    ws.receive({ type: "deliveryStatus", data: { activityId: "act-1", seq: 3, status: "delivered" } });
    ws.receive({ type: "deliveryStatus", data: { activityId: "act-1", seq: 3, status: "failed" } });
    ws.receive({ type: "deliveryStatus", data: { activityId: "act-1", status: "bogus" } });
    ws.receive({ type: "deliveryStatus", data: { status: "read" } });
    ws.receive({ type: "deliveryStatus" });
    expect(statuses).toEqual([
      ["m-1", "sent"],
      ["m-1", "delivered"],
      ["m-1", "read"],
    ]);
  });

  it("reports a delivery failure for a message that was only sent", async () => {
    const { connector, statuses } = make();
    const ws = await open(connector);
    ws.receive({ type: "deliveryStatus", data: { activityId: "bot-1", status: "sent" } });
    ws.receive({ type: "deliveryStatus", data: { activityId: "bot-1", status: "failed", error: { code: "delivery_failed" } } });
    ws.receive({ type: "deliveryStatus", data: { activityId: "bot-1", status: "delivered" } });
    expect(statuses).toEqual([
      ["bot-1", "sent"],
      ["bot-1", "failed"],
      ["bot-1", "delivered"],
    ]);
  });

  it("marks everything of ours up to a read watermark as read", async () => {
    const { connector, statuses } = make();
    const ws = await open(connector);
    ws.receive({ type: "text", id: "act-a", clientId: "old-1", seq: 1, from: "user", data: { text: "a" } });
    ws.receive({ type: "text", id: "act-b", seq: 2, from: "user", data: { text: "b" } });
    ws.receive({ type: "text", id: "act-c", seq: 7, from: "user", data: { text: "c" } });
    ws.receive({ type: "deliveryStatus", data: { upToSeq: 2, status: "read", by: { id: "agent" } } });
    expect(statuses).toEqual([
      ["old-1", "read"],
      ["act-b", "read"],
    ]);
  });

  it("fails the send on a non-retryable error naming its clientId", async () => {
    const { connector, statuses } = make();
    const ws = await open(connector);
    const sending = connector.sendMessage(msg());
    await flush();
    ws.receive({ type: "error", data: { code: "conversation_closed", message: "closed", clientId: "m-1" } });
    const err = await sending.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConvergerApiError);
    expect((err as ConvergerApiError).code).toBe("conversation_closed");
    expect(statuses).toEqual([["m-1", "failed"]]);
  });

  it("uses the code as the message when the error has none", async () => {
    const { connector } = make();
    const ws = await open(connector);
    const sending = connector.sendMessage(msg());
    await flush();
    ws.receive({ type: "error", data: { clientId: "m-1" } });
    await expect(sending).rejects.toThrow("(error): error");
  });

  it("retries a retryable error with the same clientId after retryAfterMs", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
    const { connector } = make();
    const ws = await open(connector);
    const sending = connector.sendMessage(msg());
    await flush();
    const sends = () => ws.frames().filter((f) => f.clientId === "m-1").length;
    ws.receive({ type: "error", data: { code: "rate_limited", clientId: "m-1", retryAfterMs: 200 } });
    vi.advanceTimersByTime(199);
    expect(sends()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(sends()).toBe(2);
    ws.receive({ type: "error", data: { code: "custom", retryable: true, clientId: "m-1" } });
    vi.advanceTimersByTime(1000);
    expect(sends()).toBe(3);
    ws.receive({ type: "ack", clientId: "m-1", id: "act-1", seq: 1 });
    await expect(sending).resolves.toBeUndefined();
  });

  it("gives up after maxSendRetries", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
    const { connector, statuses } = make({ maxSendRetries: 0 });
    const ws = await open(connector);
    const sending = connector.sendMessage(msg());
    await flush();
    ws.receive({ type: "error", data: { code: "unavailable", clientId: "m-1" } });
    await expect(sending).rejects.toThrow("unavailable");
    expect(statuses).toEqual([["m-1", "failed"]]);
    // A late error for a settled send is still consumed, not rendered.
    ws.receive({ type: "error", data: { code: "unavailable", clientId: "m-1" } });
  });

  it("re-sends a retried turn on the next welcome when the socket is down", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
    const { connector } = make();
    const ws = await open(connector);
    const sending = connector.sendMessage(msg());
    await flush();
    ws.receive({ type: "error", data: { code: "busy", clientId: "m-1", retryAfterMs: 10 } });
    ws.readyState = MockWebSocket.CLOSED;
    vi.advanceTimersByTime(10);
    const ws2 = await open(connector);
    expect(ws2.frames().filter((f) => f.clientId === "m-1")).toHaveLength(1);
    ws2.receive({ type: "ack", clientId: "m-1" });
    await sending;
  });

  it("fails a send that is never acknowledged", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
    const { connector, statuses } = make({ ackTimeout: 1000 });
    await open(connector);
    const sending = connector.sendMessage(msg());
    const caught = sending.catch((e: unknown) => e);
    await flush();
    vi.advanceTimersByTime(1000);
    expect(String(await caught)).toContain("no ack for m-1");
    expect(statuses).toEqual([["m-1", "failed"]]);
  });

  it("waits forever with ackTimeout 0", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
    const { connector, statuses } = make({ ackTimeout: 0 });
    const ws = await open(connector);
    const sending = connector.sendMessage(msg());
    await flush();
    vi.advanceTimersByTime(10 * 60_000);
    expect(statuses).toEqual([]);
    ws.receive({ type: "ack", clientId: "m-1" });
    await sending;
  });

  it("resolves at once against a server that does not ack", async () => {
    const { connector } = make();
    await open(connector, WELCOME("conv-1", { capabilities: {} }));
    await expect(connector.sendMessage(msg())).resolves.toBeUndefined();
  });

  it("re-sends unacked turns with their clientId after a reconnect", async () => {
    const { connector } = make();
    const ws1 = await open(connector);
    const sending = connector.sendMessage(msg());
    await flush();
    ws1.readyState = MockWebSocket.CLOSED;
    const ws2 = await open(connector);
    const resent = ws2.frames().filter((f) => f.clientId === "m-1");
    expect(resent).toHaveLength(1);
    ws2.receive({ type: "ack", clientId: "m-1", id: "act-1", seq: 1, duplicate: true });
    await sending;
  });

  it("flushes a turn queued while offline and then waits for its ack", async () => {
    const { connector } = make();
    const sending = connector.sendMessage(msg());
    await flush();
    const ws = await open(connector);
    expect(ws.frames().filter((f) => f.clientId === "m-1")).toHaveLength(1);
    ws.receive({ type: "ack", clientId: "m-1" });
    await sending;
  });

  it("settles queued turns when the server turns out not to ack", async () => {
    const { connector } = make();
    const ws1 = await open(connector);
    const sending = connector.sendMessage(msg());
    await flush();
    ws1.readyState = MockWebSocket.CLOSED;
    await open(connector, WELCOME("conv-1", { capabilities: { acks: false } }));
    await expect(sending).resolves.toBeUndefined();
  });

  it("does not re-send a turn of another conversation", async () => {
    const { connector } = make({ conversationId: "conv-1", historyPageSize: 0 });
    const ws1 = await open(connector);
    const sending = connector.sendMessage(msg());
    await flush();
    ws1.readyState = MockWebSocket.CLOSED;
    const ws2 = await open(connector, WELCOME("conv-2"));
    expect(ws2.frames().filter((f) => f.clientId === "m-1")).toHaveLength(0);
    ws2.receive({ type: "ack", clientId: "m-1" });
    await sending;
  });

  it("sends a message whose id is not a valid clientId without waiting for an ack", async () => {
    const { connector } = make();
    const ws = await open(connector);
    await connector.sendMessage(msg("has spaces"));
    expect(ws.last().clientId).toBeUndefined();
  });

  it("does not wait for an ack on an interrupt answer (resume)", async () => {
    const { connector } = make();
    const ws = await open(connector);
    ws.receive({ type: "interrupt", id: "int-1", seq: 1, data: { payload: { title: "Go?" }, actions: [{ label: "Yes", value: true }] } });
    await connector.sendMessage(msg("m-2", "Yes"));
    expect(ws.last()).toEqual({ type: "resume", answers: { "int-1": true } });
  });

  it("rejects and forgets the send when the socket is down and queueing is off", async () => {
    const { connector } = make({ queueOfflineMessages: false });
    await expect(connector.sendMessage(msg())).rejects.toThrow("not connected");
  });
});

// ── Auth errors ─────────────────────────────────────────────────────────

describe("ConvergerConnector — auth", () => {
  it("treats token_expired as an auth rejection and retries with a fresh token", async () => {
    const tokens = ["t1", "t2"];
    const onAuthError = vi.fn();
    const { connector } = make({
      auth: new TokenAuth({ token: () => tokens.shift() ?? "t3" }),
      onAuthError,
    });
    const ws = await open(connector);
    ws.receive({ type: "error", data: { code: "token_expired", message: "expired", number: 2001 } });
    expect(onAuthError).toHaveBeenCalledWith({ code: "unauthorized", message: "expired" });
    await flush();
    const ws2 = MockWebSocket.instances[1];
    ws2.open();
    expect(ws2.frames()[0].token).toBe("t2");
  });

  it("fails an auth rejection without a provider that can retry", async () => {
    const { connector } = make({ auth: { name: "x", authenticate: () => ({ token: "a" }) } });
    const ws = await open(connector);
    ws.receive({ type: "error", data: { code: "token_revoked", message: "revoked" } });
    await flush();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("leaves errors without a clientId to the mekik routing", async () => {
    const { connector, messages } = make();
    const ws = await open(connector);
    ws.receive({ type: "error", data: { code: "bot_unavailable", message: "no bot" } });
    ws.receive({ type: "error" });
    expect(messages).toEqual([]);
  });

  it("puts a conversation-bound token in the query for the query transport", async () => {
    mockFetch({
      "POST /conversations": { conversationId: "conv-9", token: "bound-9", expires_in: 1800 },
    });
    const { connector } = make({
      auth: new TokenAuth({ token: "chan", transport: "query", queryParam: "access" }),
      channelScoped: true,
    });
    await connector.connect();
    await connector.createConversation("T");
    const switching = connector.switchConversation("conv-9");
    await flush();
    const ws = MockWebSocket.instances[0];
    expect(new URL(ws.url).searchParams.get("access")).toBe("bound-9");
    ws.open();
    await switching;
  });
});

// ── Attachments, uploads, reactions ────────────────────────────────────

describe("ConvergerConnector — attachments", () => {
  const upload = (name: string, contentType: string, text = "") => ({
    type: "text",
    id: "act-up",
    seq: 4,
    from: "user",
    data: {
      text,
      attachments: [{ contentType, contentUrl: `http://hub.test/api/v1/converger/attachments/${name}`, name, size: 10 }],
    },
    timestamp: 7,
  });

  it.each([
    ["receipt.png", "image/png", "image", { src: "http://hub.test/api/v1/converger/attachments/receipt.png", alt: "receipt.png" }],
    ["clip.mp4", "video/mp4", "video", { src: "http://hub.test/api/v1/converger/attachments/clip.mp4" }],
    [
      "doc.pdf",
      "application/pdf",
      "file",
      { url: "http://hub.test/api/v1/converger/attachments/doc.pdf", name: "doc.pdf", mimeType: "application/pdf", size: 10 },
    ],
  ])("renders %s as a %s message", async (name, contentType, type, data) => {
    const { connector, messages } = make();
    const ws = await open(connector);
    ws.receive(upload(name, contentType, "caption"));
    expect(messages[0]).toEqual({ id: "act-up", type, from: "user", data: { ...data, caption: "caption" }, timestamp: 7 });
  });

  it("falls back to sensible defaults for a sparse attachment", async () => {
    const { connector, messages } = make();
    const ws = await open(connector);
    ws.receive({ type: "text", data: { attachments: [{ contentUrl: "https://cdn/x" }] } });
    expect(messages[0]).toMatchObject({ type: "file", data: { url: "https://cdn/x", name: "file", mimeType: "" } });
    expect(messages[0].id).toMatch(/^converger-/);
  });

  it("keeps a text frame without a usable attachment as text", async () => {
    const { connector, messages } = make();
    const ws = await open(connector);
    ws.receive({ type: "text", id: "t", from: "bot", data: { text: "x", attachments: ["nope"] } });
    ws.receive({ type: "text", id: "u", from: "bot", data: { text: "y", attachments: [{ name: "n" }] } });
    expect(messages.map((m) => m.type)).toEqual(["text", "text"]);
  });

  it("swaps a protected attachment URL for an authorized blob URL", async () => {
    const { fn } = mockFetch({
      "GET /attachments/receipt.png": () => new Response(new Blob(["png"], { type: "image/png" })),
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local");
    const { connector } = make();
    const { ctx, raw } = fakeContext();
    connector.setContext(ctx);
    const ws = await open(connector);
    ws.receive(upload("receipt.png", "image/png"));
    await flush();
    const call = fn.mock.calls.find(([u]) => String(u).includes("/attachments/"));
    expect(new Headers(call![1]!.headers).get("authorization")).toBe("Bearer tok");
    expect(raw.messages.update).toHaveBeenCalledWith("act-up", { data: { src: "blob:local", alt: "receipt.png" } });
  });

  it("keeps the original URL when the attachment cannot be fetched", async () => {
    mockFetch({ "GET /attachments/doc.pdf": json({}, 404) });
    const { connector } = make();
    const { ctx, raw } = fakeContext();
    connector.setContext(ctx);
    const ws = await open(connector);
    ws.receive(upload("doc.pdf", "application/pdf"));
    await flush();
    expect(raw.messages.update).not.toHaveBeenCalled();
  });

  it("leaves URLs outside the API alone", async () => {
    const { fn } = mockFetch({});
    const { connector } = make();
    connector.setContext(fakeContext().ctx);
    const ws = await open(connector);
    ws.receive({ type: "text", data: { attachments: [{ contentType: "image/png", contentUrl: "https://cdn/x.png" }] } });
    await flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it("uploads a file as multipart and shows the returned frame with a local preview", async () => {
    let seen: Call | null = null;
    mockFetch({
      "POST /conversations/conv-1/upload": (call: Call) => {
        seen = call;
        return json({ id: "act-up", seq: 4, frame: upload("receipt.png", "image/png", "my receipt") });
      },
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    const { connector, messages } = make();
    await open(connector);
    const file = new File(["png-bytes"], "receipt.png", { type: "image/png" });
    await connector.sendFile(file, { caption: "my receipt", orderId: "ORD-42" });
    const form = seen!.body as FormData;
    expect(seen!.headers.get("authorization")).toBe("Bearer tok");
    expect((form.get("file") as File).name).toBe("receipt.png");
    expect(JSON.parse(String(form.get("activity")))).toEqual({ text: "my receipt", channelData: { orderId: "ORD-42" } });
    expect(messages[0]).toMatchObject({ id: "act-up", type: "image", data: { src: "blob:preview", caption: "my receipt" } });
  });

  it("uses the local preview as the file URL of a non-image upload", async () => {
    mockFetch({ "POST /conversations/conv-1/upload": json({ frame: upload("doc.pdf", "application/pdf") }) });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:doc");
    const { connector, messages } = make();
    await open(connector);
    await connector.sendFile(new File(["%PDF"], "doc.pdf"));
    expect(messages[0]).toMatchObject({ type: "file", data: { url: "blob:doc" } });
  });

  it("shows the frame as it came when it carries no attachment", async () => {
    mockFetch({ "POST /conversations/conv-1/upload": json({ frame: { type: "text", id: "x", from: "user", data: { text: "" } } }) });
    const { connector, messages } = make();
    await open(connector);
    await connector.sendFile(new File(["a"], "a.txt"));
    expect(messages[0]).toMatchObject({ id: "x", type: "text" });
  });

  it("hands an upload to chativa once, whichever copy arrives first", async () => {
    mockFetch({ "POST /conversations/conv-1/upload": json({ frame: upload("doc.pdf", "application/pdf") }) });
    const { connector, messages } = make();
    const ws = await open(connector);
    await connector.sendFile(new File(["%PDF"], "doc.pdf"));
    ws.receive(upload("doc.pdf", "application/pdf"));
    expect(messages).toHaveLength(1);

    const second = make();
    const ws2 = await open(second.connector);
    ws2.receive(upload("doc.pdf", "application/pdf"));
    await second.connector.sendFile(new File(["%PDF"], "doc.pdf"));
    expect(second.messages).toHaveLength(1);
  });

  it("does nothing more when the upload answer has no frame", async () => {
    mockFetch({ "POST /conversations/conv-1/upload": json({ id: "act" }) });
    const { connector, messages } = make();
    await open(connector);
    await connector.sendFile(new File(["a"], "a.txt"));
    expect(messages).toEqual([]);
  });

  it("surfaces an upload refusal as ConvergerApiError", async () => {
    mockFetch({
      "POST /conversations/conv-1/upload": json({ error: { code: "unsupported_media_type", message: "nope" } }, 415),
    });
    const { connector } = make();
    await open(connector);
    const err = await connector.sendFile(new File(["a"], "a.bin")).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConvergerApiError);
    expect(err).toMatchObject({ status: 415, code: "unsupported_media_type" });
  });

  it("needs a conversation to upload to", async () => {
    const { connector } = make();
    await expect(connector.sendFile(new File(["a"], "a.txt"))).rejects.toThrow("no conversation yet");
  });

  it("posts feedback as a messageReaction replying to the activity", async () => {
    const bodies: unknown[] = [];
    mockFetch({
      "POST /conversations/conv-1/activities": (call: Call) => {
        bodies.push(JSON.parse(String(call.body)));
        return json({ id: "r1" });
      },
    });
    const { connector } = make({ feedbackReactions: { dislike: "-1" } });
    const ws = await open(connector);
    const sending = connector.sendMessage({ id: "m-1", type: "text", data: { text: "x" } });
    await flush();
    ws.receive({ type: "ack", clientId: "m-1", id: "act-1", seq: 1 });
    await sending;
    await connector.sendFeedback("bot-msg", "like");
    await connector.sendFeedback("m-1", "dislike");
    expect(bodies).toEqual([
      { type: "messageReaction", replyToId: "bot-msg", text: "👍" },
      { type: "messageReaction", replyToId: "act-1", text: "-1" },
    ]);
  });
});

// ── History ─────────────────────────────────────────────────────────────

describe("ConvergerConnector — history", () => {
  const page = (frames: unknown[], extra: Record<string, unknown> = {}) => json({ frames, has_more: true, cursor: "81", ...extra });

  it("fetches the newest page before the socket and replays only what is newer", async () => {
    const calls: URL[] = [];
    mockFetch({
      "GET /conversations/conv-1/activities": (call: Call) => {
        calls.push(call.url);
        return page([
          { type: "text", id: "a81", seq: 81, from: "user", clientId: "c-81", data: { text: "Where?" }, timestamp: 1 },
          { type: "tool_call", seq: 82, data: { id: "t1", name: "x", status: "completed" } },
          { type: "text", id: "a83", seq: 83, from: "bot", data: { text: "Pick" }, actions: [{ label: "A" }] },
          { type: "card", id: "a84", seq: 84, from: "bot", data: { title: "c" } },
          { type: "weird", seq: 85 },
          { seq: 86 },
        ]);
      },
    });
    const { connector } = make({ conversationId: "conv-1" });
    const ws = await open(connector);
    expect(ws.frames()[0].watermark).toBe(86);
    expect(calls[0].searchParams.get("direction")).toBe("backward");
    expect(calls[0].searchParams.get("format")).toBe("frames");
    expect(calls[0].searchParams.get("limit")).toBe("50");
    expect(calls[0].searchParams.has("before")).toBe(false);

    const first = await connector.loadHistory();
    expect(first.hasMore).toBe(true);
    expect(first.cursor).toBe("81");
    expect(first.messages.map((m) => [m.id, m.type])).toEqual([
      ["c-81", "text"],
      ["a83", "quick-reply"],
      ["a84", "card"],
    ]);

    await connector.loadHistory("81");
    expect(calls[1].searchParams.get("before")).toBe("81");
    expect(calls[1].searchParams.get("userId")).toBe("user-42");
  });

  it("maps an older page's own messages and read receipts", async () => {
    mockFetch({
      "GET /conversations/conv-1/activities": page([{ type: "text", id: "a1", seq: 1, from: "user", data: { text: "x" } }], { cursor: null, has_more: false }),
    });
    const { connector, statuses } = make({ conversationId: "conv-1" });
    const ws = await open(connector);
    const first = await connector.loadHistory();
    expect(first).toEqual({ messages: [expect.objectContaining({ id: "a1" })], hasMore: false });
    ws.receive({ type: "deliveryStatus", data: { upToSeq: 1, status: "read" } });
    expect(statuses).toEqual([["a1", "read"]]);
  });

  it("falls back to a full socket replay when the first page cannot be fetched", async () => {
    mockFetch({ "GET /conversations/conv-1/activities": json({ error: {} }, 500) });
    const { connector } = make({ conversationId: "conv-1" });
    const ws = await open(connector);
    expect(ws.frames()[0].watermark).toBe(0);
  });

  it("pages below the resume point when the socket resumes from a watermark", async () => {
    const urls: URL[] = [];
    mockFetch({
      "GET /conversations/conv-1/activities": (call: Call) => {
        urls.push(call.url);
        return json({ frames: "nope" });
      },
    });
    const { connector } = make({ conversationId: "conv-1" });
    (connector as unknown as { watermark: number }).watermark = 40;
    const ws = await open(connector);
    expect(ws.frames()[0].watermark).toBe(40);
    expect(urls).toHaveLength(0);
    const result = await connector.loadHistory();
    expect(urls[0].searchParams.get("before")).toBe("41");
    expect(result).toEqual({ messages: [], hasMore: false });
  });

  it("has no history without a conversation, or with paging off", async () => {
    const { fn } = mockFetch({});
    expect(await make().connector.loadHistory()).toEqual({ messages: [], hasMore: false });
    const { connector } = make({ conversationId: "conv-1", historyPageSize: 0 });
    const ws = await open(connector);
    expect(ws.frames()[0].watermark).toBe(0);
    expect(await connector.loadHistory()).toEqual({ messages: [], hasMore: false });
    expect(fn).not.toHaveBeenCalled();
  });

  it("drops the prefetched page when the server starts a different conversation", async () => {
    const urls: URL[] = [];
    mockFetch({
      "GET /conversations/gone/activities": page([{ type: "text", id: "x", seq: 3, from: "bot", data: { text: "old" } }]),
      "GET /conversations/fresh/activities": (call: Call) => {
        urls.push(call.url);
        return page([], { has_more: false, cursor: null });
      },
    });
    const { connector } = make({ conversationId: "gone" });
    await open(connector, WELCOME("fresh"));
    const result = await connector.loadHistory();
    expect(result.messages).toEqual([]);
    expect(urls[0].searchParams.has("before")).toBe(false);
  });
});

// ── Read receipts ───────────────────────────────────────────────────────

describe("ConvergerConnector — read receipts", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
  });

  const reads = (ws: MockWebSocket) => ws.frames().filter((f) => f.type === "read");

  it("sends read for the other side's live messages while the widget is open", async () => {
    const { connector } = make();
    connector.setContext(fakeContext(true).ctx);
    const ws = await open(connector);
    ws.receive({ type: "text", id: "b1", seq: 5, from: "bot", data: { text: "hi" } });
    ws.receive({ type: "text", id: "b2", seq: 6, from: "bot", data: { text: "again" } });
    vi.advanceTimersByTime(500);
    expect(reads(ws)).toEqual([{ type: "read", watermark: 6 }]);
    vi.advanceTimersByTime(5000);
    expect(reads(ws)).toHaveLength(1);
  });

  it("waits for the widget to open", async () => {
    const { connector } = make();
    const { ctx, raw, handlers } = fakeContext(false);
    connector.setContext(ctx);
    const ws = await open(connector);
    ws.receive({ type: "text", id: "b1", seq: 5, from: "bot", data: { text: "hi" } });
    vi.advanceTimersByTime(500);
    expect(reads(ws)).toEqual([]);
    raw.chat.isOpened.mockReturnValue(true);
    handlers.widget_opened();
    vi.advanceTimersByTime(0);
    expect(reads(ws)).toEqual([{ type: "read", watermark: 5 }]);
  });

  it("does not send read for replayed frames, own frames, when disabled or offline", async () => {
    const { connector } = make();
    const ws = await open(connector, WELCOME("conv-1", { watermark: 10 }));
    ws.receive({ type: "text", id: "old", seq: 9, from: "bot", data: { text: "replayed" } });
    ws.receive({ type: "text", id: "mine", seq: 11, from: "user", data: { text: "me" } });
    vi.advanceTimersByTime(1000);
    expect(reads(ws)).toEqual([]);

    const off = make({ readReceipts: false });
    const ws2 = await open(off.connector);
    ws2.receive({ type: "text", id: "b", seq: 3, from: "bot", data: { text: "x" } });
    vi.advanceTimersByTime(1000);
    expect(reads(ws2)).toEqual([]);

    const down = make();
    const ws3 = await open(down.connector);
    ws3.receive({ type: "text", id: "b", seq: 3, from: "bot", data: { text: "x" } });
    ws3.readyState = MockWebSocket.CLOSED;
    vi.advanceTimersByTime(1000);
    expect(reads(ws3)).toEqual([]);
  });
});

// ── Agent panel ─────────────────────────────────────────────────────────

describe("ConvergerConnector — multi-conversation", () => {
  const list = {
    conversations: [
      {
        id: "c-1",
        title: "Order ORD-42",
        contact: "Ayse",
        status: "active",
        lastMessage: "Where?",
        lastMessageAt: 100,
        lastSeq: 120,
        metadata: { source: "converger" },
      },
      { id: "c-2", title: null, contact: "+90555", status: "closed", lastMessage: null, lastSeq: 3 },
      { id: "c-3", status: "active" },
      { nope: true },
    ],
    cursor: null,
    has_more: false,
  };

  function agentFetch() {
    const exchanged: string[] = [];
    const { fn, calls } = mockFetch({
      "GET /conversations": list,
      "GET /conversations/c-1": () => {
        exchanged.push("c-1");
        return json({ conversationId: "c-1", token: "bound-1", expires_in: 1800 });
      },
      "GET /conversations/c-2": () => {
        exchanged.push("c-2");
        return json({ conversationId: "c-2", token: "bound-2" });
      },
      "GET /conversations/c-3": json({ conversationId: "c-3" }),
      "POST /conversations": json({ conversationId: "c-new", token: "bound-new", expires_in: 1800 }, 201),
      "POST /conversations/c-2/close": json({ conversationId: "c-2", status: "closed" }),
    });
    return { fn, calls, exchanged };
  }

  async function switchTo(connector: ConvergerConnector, id: string) {
    const before = MockWebSocket.instances.length;
    const switching = connector.switchConversation(id);
    await flush();
    const ws = MockWebSocket.instances[before];
    ws.open();
    await switching;
    ws.receive(WELCOME(id));
    return ws;
  }

  it("opens no socket before a conversation is chosen", async () => {
    agentFetch();
    const { connector } = make({ channelScoped: true });
    const onConnect = vi.fn();
    connector.onConnect(onConnect);
    await connector.connect();
    expect(MockWebSocket.instances).toHaveLength(0);
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it("lists the channel's conversations in chativa's shape", async () => {
    const { calls } = agentFetch();
    const { connector } = make({ channelScoped: true });
    const conversations = await connector.listConversations();
    expect(calls[0].url.searchParams.get("limit")).toBe("100");
    expect(calls[0].headers.get("authorization")).toBe("Bearer tok");
    expect(conversations).toEqual([
      {
        id: "c-1",
        title: "Order ORD-42",
        status: "open",
        contact: "Ayse",
        lastMessage: "Where?",
        lastMessageAt: 100,
        metadata: { source: "converger" },
      },
      { id: "c-2", title: "+90555", status: "closed", contact: "+90555" },
      { id: "c-3", title: "c-3", status: "open" },
    ]);
  });

  it("returns an empty list for an unexpected answer", async () => {
    mockFetch({ "GET /conversations": json(null) });
    expect(await make().connector.listConversations()).toEqual([]);
  });

  it("switches with a conversation-bound token, starting just below the newest page", async () => {
    const { exchanged } = agentFetch();
    const { connector } = make({ channelScoped: true, historyPageSize: 20 });
    await connector.listConversations();
    const ws = await switchTo(connector, "c-1");
    expect(exchanged).toEqual(["c-1"]);
    expect(ws.frames()[0]).toMatchObject({ conversationId: "c-1", token: "bound-1", watermark: 100 });

    // c-2 has fewer frames than a page: replay it all.
    const ws2 = await switchTo(connector, "c-2");
    expect(ws2.frames()[0]).toMatchObject({ conversationId: "c-2", token: "bound-2", watermark: 0 });
    ws2.receive({ type: "text", id: "x", seq: 9, from: "bot", data: { text: "x" } });

    // Back to c-1: the cached bound token, and the resume point we left at.
    const ws3 = await switchTo(connector, "c-1");
    expect(exchanged).toEqual(["c-1", "c-2"]);
    expect(ws3.frames()[0]).toMatchObject({ token: "bound-1", watermark: 100 });

    // c-2's token had no expires_in, so it lasts the default 30 minutes.
    const ws4 = await switchTo(connector, "c-2");
    expect(exchanged).toEqual(["c-1", "c-2"]);
    expect(ws4.frames()[0]).toMatchObject({ token: "bound-2", watermark: 9 });
  });

  it("re-exchanges a bound token that is about to expire", async () => {
    const { exchanged } = agentFetch();
    const now = vi.spyOn(Date, "now");
    const { connector } = make({ channelScoped: true });
    await switchTo(connector, "c-1");
    await switchTo(connector, "c-2");
    now.mockReturnValue(Date.now() + 1800 * 1000);
    await switchTo(connector, "c-1");
    expect(exchanged).toEqual(["c-1", "c-2", "c-1"]);
  });

  it("falls back to the app's token when the exchange returns none", async () => {
    agentFetch();
    const { connector } = make({ channelScoped: true });
    const ws = await switchTo(connector, "c-3");
    expect(ws.frames()[0].token).toBe("tok");
  });

  it("does nothing when switching to the open conversation", async () => {
    agentFetch();
    const { connector } = make({ channelScoped: true });
    await switchTo(connector, "c-1");
    await connector.switchConversation("c-1");
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("fails the unacked sends of the conversation it leaves", async () => {
    agentFetch();
    const { connector, statuses } = make({ channelScoped: true });
    await switchTo(connector, "c-1");
    const sending = connector.sendMessage({ id: "m-1", type: "text", data: { text: "x" } });
    const caught = sending.catch((e: unknown) => e);
    await flush();
    await switchTo(connector, "c-2");
    expect(String(await caught)).toContain("switched conversation");
    expect(statuses).toEqual([["m-1", "failed"]]);
  });

  it("creates a conversation and opens it with the token it came with", async () => {
    const { calls, exchanged } = agentFetch();
    const { connector } = make({ channelScoped: true });
    const created = await connector.createConversation("New chat", { priority: "high" });
    expect(JSON.parse(String(calls[0].body))).toEqual({ title: "New chat" });
    expect(created).toMatchObject({ id: "c-new", title: "New chat", status: "open", metadata: { priority: "high" } });
    const ws = await switchTo(connector, "c-new");
    expect(exchanged).toEqual([]);
    expect(ws.frames()[0]).toMatchObject({ token: "bound-new", watermark: 0 });
  });

  it("creates an untitled conversation", async () => {
    const { calls } = agentFetch();
    const created = await make().connector.createConversation();
    expect(JSON.parse(String(calls[0].body))).toEqual({});
    expect(created.title).toBe("c-new");
  });

  it("rejects a create answer without a conversation id", async () => {
    mockFetch({ "POST /conversations": json({}) });
    await expect(make().connector.createConversation("x")).rejects.toThrow("no conversationId");
  });

  it("closes a conversation", async () => {
    const { calls } = agentFetch();
    await make({ channelScoped: true }).connector.closeConversation("c-2");
    expect(calls[0]).toMatchObject({ method: "POST" });
    expect(calls[0].url.pathname).toBe("/api/v1/converger/conversations/c-2/close");
  });

  it("reports conversationUpdate frames and live previews", async () => {
    agentFetch();
    const { connector, conversations, messages } = make({ channelScoped: true });
    await connector.listConversations();
    const ws = await switchTo(connector, "c-1");
    ws.receive({ type: "text", id: "n1", seq: 121, from: "bot", data: { text: "New!" }, timestamp: 555 });
    ws.receive({ type: "tool_call", seq: 122, data: { id: "t", name: "x", status: "running" } });
    ws.receive({ type: "conversationUpdate", id: "u1", seq: 123, data: { event: "conversation_closed", status: "closed" } });
    ws.receive({ type: "conversationUpdate", id: "u2", seq: 124, data: { event: "conversation_reopened" } });
    ws.receive({ type: "conversationUpdate", id: "u3", seq: 125, data: { event: "participant_joined" } });
    ws.receive({ type: "conversationUpdate", seq: 126 });
    expect(conversations.map((c) => [c.id, c.title, c.status, c.lastMessage, c.lastMessageAt])).toEqual([
      ["c-1", "Order ORD-42", "open", "New!", 555],
      ["c-1", "Order ORD-42", "closed", "New!", 555],
      ["c-1", "Order ORD-42", "open", "New!", 555],
    ]);
    expect(messages.map((m) => m.id)).toEqual(["n1"]);
  });

  it("ignores conversationUpdate before any conversation is known", async () => {
    const { connector, conversations } = make();
    const ws = await open(connector, { type: "welcome", data: { capabilities: { acks: true } } });
    ws.receive({ type: "conversationUpdate", seq: 1, data: { status: "closed" } });
    ws.receive({ type: "text", id: "n", seq: 2, from: "bot", data: { text: "hi" } });
    expect(conversations).toEqual([]);
  });

  it("previews a message of an unlisted conversation under its id", async () => {
    const { connector, conversations } = make();
    const ws = await open(connector);
    ws.receive({ type: "text", id: "n", seq: 2, from: "bot", data: { text: "hi" } });
    expect(conversations[0]).toMatchObject({ id: "conv-1", title: "conv-1", status: "open", lastMessage: "hi" });
    expect(typeof conversations[0].lastMessageAt).toBe("number");
  });
});

// ── REST plumbing ───────────────────────────────────────────────────────

describe("ConvergerConnector — REST", () => {
  it("refreshes the token once on a 401 and retries", async () => {
    let n = 0;
    const seen: string[] = [];
    mockFetch({
      "GET /conversations": (call: Call) => {
        seen.push(call.headers.get("authorization") ?? "");
        return ++n === 1 ? json({ error: { code: "token_expired" } }, 401) : json({ conversations: [] });
      },
    });
    const tokens = ["old", "new"];
    const { connector } = make({ auth: new TokenAuth({ token: () => tokens.shift()! }) });
    await connector.listConversations();
    expect(seen).toEqual(["Bearer old", "Bearer new"]);
  });

  it("does not retry a second 401", async () => {
    mockFetch({ "GET /conversations": json({ error: { code: "unauthorized", message: "bad" } }, 401) });
    const err = await make().connector.listConversations().catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 401, code: "unauthorized" });
  });

  it("names an error without a JSON body by its HTTP status", async () => {
    mockFetch({ "GET /conversations": () => new Response("boom", { status: 502, statusText: "Bad Gateway" }) });
    const err = await make().connector.listConversations().catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 502, code: "http_502" });
    expect(String(err)).toContain("Bad Gateway");
  });

  it("accepts a flat error body", async () => {
    mockFetch({ "GET /conversations": json({ code: "forbidden", message: "channel scope needed" }, 403) });
    const err = await make().connector.listConversations().catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 403, code: "forbidden" });
  });

  it("treats 204 and non-JSON success bodies as empty", async () => {
    mockFetch({
      "POST /conversations/a/close": () => new Response(null, { status: 204 }),
      "POST /conversations/b/close": () => new Response("ok", { status: 200 }),
    });
    const { connector } = make();
    await expect(connector.closeConversation("a")).resolves.toBeUndefined();
    await expect(connector.closeConversation("b")).resolves.toBeUndefined();
  });

  it("needs a token for REST calls", async () => {
    const noAuth = make({ auth: undefined });
    await expect(noAuth.connector.listConversations()).rejects.toThrow("needs a token");
    const cookie = make({ auth: { name: "cookie", authenticate: () => ({}) } });
    await expect(cookie.connector.listConversations()).rejects.toThrow("needs a token");
  });

  it("reuses the socket's token for REST without asking the provider again", async () => {
    mockFetch({ "GET /conversations": json({ conversations: [] }) });
    const token = vi.fn(() => "sock");
    const { connector } = make({ auth: new TokenAuth({ token }) });
    await open(connector);
    await connector.listConversations();
    expect(token).toHaveBeenCalledOnce();
  });

  it("drops cached tokens on a socket auth rejection before asking the provider", async () => {
    mockFetch({ "GET /conversations/c-1": json({ conversationId: "c-1", token: "bound", expires_in: 1800 }) });
    const onReject = vi.fn(() => "fail" as const);
    const { connector } = make({
      channelScoped: true,
      auth: { name: "x", authenticate: () => ({ token: "chan" }), onReject },
    });
    const switching = connector.switchConversation("c-1");
    await flush();
    const ws = MockWebSocket.instances[0];
    ws.open();
    await switching;
    ws.receive({ type: "error", data: { code: "unauthorized", message: "nope" } });
    await flush();
    expect(onReject).toHaveBeenCalledOnce();
  });
});
