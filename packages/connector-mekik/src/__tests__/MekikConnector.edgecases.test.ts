import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MekikConnector, CookieAuth, TokenAuth } from "../index";
import type { MekikAuthProvider, MekikConnectorOptions } from "../index";

/**
 * Edge cases and error paths of MekikConnector not covered by the main suite:
 * session resume / persistence, offline queue, reconnect pacing, frame
 * routing fallbacks, interrupt answering and client-tool corner cases.
 */

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

  serverClose(reason = "", code?: number): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ reason, code });
  }

  receive(frame: unknown): void {
    this.onmessage?.({ data: typeof frame === "string" ? frame : JSON.stringify(frame) });
  }

  frames(): Array<Record<string, unknown>> {
    return this.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
  }
}

type Internals = {
  routeFrame(raw: string): void;
  watermark: number;
  closedByUser: boolean;
  queue: Array<{ payload: string }>;
  options: { userId?: string; conversationId?: string };
};

function internals(connector: MekikConnector): Internals {
  return connector as unknown as Internals;
}

function route(connector: MekikConnector, frame: unknown): void {
  internals(connector).routeFrame(typeof frame === "string" ? frame : JSON.stringify(frame));
}

/** In-memory localStorage stub. */
function stubStorage(seed?: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  });
  return map;
}

async function socketAt(index: number): Promise<MockWebSocket> {
  for (let i = 0; i < 50 && !MockWebSocket.instances[index]; i++) {
    await Promise.resolve();
  }
  const ws = MockWebSocket.instances[index];
  if (!ws) throw new Error(`no socket was created at index ${index}`);
  return ws;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

/** Connect and open the first socket; returns it. */
async function connectOpen(connector: MekikConnector, index = 0): Promise<MockWebSocket> {
  const p = connector.connect();
  const ws = await socketAt(index);
  ws.open();
  await p;
  return ws;
}

function make(extra: Partial<MekikConnectorOptions> = {}) {
  const connector = new MekikConnector({ url: "ws://test", reconnect: false, ...extra });
  const messages: Array<Record<string, unknown>> = [];
  const typing: boolean[] = [];
  const chunks: Array<{ streamId: string; chunk: unknown; done?: boolean }> = [];
  connector.onMessage((m) => messages.push(m as unknown as Record<string, unknown>));
  connector.onTyping((t) => typing.push(t));
  connector.onGenUIChunk((streamId, chunk, done) => chunks.push({ streamId, chunk, done }));
  return { connector, messages, typing, chunks };
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── session resume / persistence ────────────────────────────────────────

describe("MekikConnector resumeConversation", () => {
  it("restores identity and watermark from storage and resumes with them in hello", async () => {
    stubStorage({
      "chativa:mekik:ws://test": JSON.stringify({ userId: "u-saved", conversationId: "c-saved", watermark: 17 }),
    });
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, resumeConversation: true });
    const ws = await connectOpen(connector);
    expect(ws.frames()[0]).toMatchObject({
      type: "hello",
      userId: "u-saved",
      conversationId: "c-saved",
      watermark: 17,
    });
  });

  it("explicit options win over the stored session; a missing stored watermark means 0", () => {
    stubStorage({ "chativa:mekik:ws://test:alice": JSON.stringify({ userId: "x", conversationId: "c-saved" }) });
    const connector = new MekikConnector({
      url: "ws://test",
      reconnect: false,
      resumeConversation: true,
      userId: "alice",
    });
    const i = internals(connector);
    expect(i.options.userId).toBe("alice");
    // Scoped key (configured userId suffix) was read.
    expect(i.options.conversationId).toBe("c-saved");
    expect(i.watermark).toBe(0);
  });

  it("starts fresh when nothing is stored", () => {
    stubStorage();
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, resumeConversation: true });
    expect(internals(connector).watermark).toBe(0);
    expect(internals(connector).options.conversationId).toBeUndefined();
  });

  it("treats corrupt stored JSON as no session", () => {
    stubStorage({ "chativa:mekik:ws://test": "{not json" });
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, resumeConversation: true });
    expect(internals(connector).watermark).toBe(0);
  });

  it("works without any localStorage at all", () => {
    vi.stubGlobal("localStorage", undefined);
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, resumeConversation: true });
    // Neither load nor save throws.
    route(connector, { type: "welcome", data: { conversationId: "c1", userId: "u1" } });
    route(connector, { type: "text", seq: 3, from: "bot", data: { text: "x" } });
    expect(internals(connector).watermark).toBe(3);
  });

  it("persists the welcome identity and every new watermark", () => {
    const map = stubStorage();
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, resumeConversation: true });
    route(connector, { type: "welcome", data: { conversationId: "c1", userId: "u1", connectionId: "k", watermark: 0 } });
    expect(JSON.parse(map.get("chativa:mekik:ws://test")!)).toEqual({ userId: "u1", conversationId: "c1", watermark: 0 });

    route(connector, { type: "text", seq: 9, from: "bot", data: { text: "hi" } });
    expect(JSON.parse(map.get("chativa:mekik:ws://test")!).watermark).toBe(9);

    // A lower seq (replay) does not move the watermark back.
    route(connector, { type: "text", seq: 4, from: "bot", data: { text: "old" } });
    expect(JSON.parse(map.get("chativa:mekik:ws://test")!).watermark).toBe(9);
  });

  it("swallows storage write failures (quota / private mode)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, resumeConversation: true });
    expect(() => route(connector, { type: "text", seq: 1, from: "bot", data: { text: "x" } })).not.toThrow();
    expect(internals(connector).watermark).toBe(1);
  });

  it("swallows storage read failures", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
    });
    expect(() => new MekikConnector({ url: "ws://test", resumeConversation: true })).not.toThrow();
  });
});

// ── welcome edge cases ──────────────────────────────────────────────────

describe("MekikConnector welcome", () => {
  it("accepts a flattened welcome payload and leaves ids empty when nobody knows them", () => {
    const { connector } = make();
    route(connector, { type: "welcome", connectionId: "cx" });
    expect(connector.identity).toEqual({ conversationId: "", userId: "", connectionId: "cx", watermark: 0 });
    expect(internals(connector).options.userId).toBeUndefined();
    expect(internals(connector).options.conversationId).toBeUndefined();
  });

  it("skips non-object entries in welcome.pending", () => {
    const { connector, messages } = make();
    route(connector, {
      type: "welcome",
      data: { conversationId: "c", userId: "u", pending: [null, "junk", { id: "p1", data: { payload: { text: "Go?" } } }] },
    });
    expect(messages).toHaveLength(1);
    expect((messages[0].data as Record<string, unknown>).text).toBe("Go?");
  });
});

// ── frame routing fallbacks ─────────────────────────────────────────────

describe("MekikConnector frame routing", () => {
  it("surfaces a non-JSON frame as a plain text message", () => {
    const { connector, messages } = make();
    route(connector, "just some text");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: "text", data: { text: "just some text" } });
    expect(String(messages[0].id)).toMatch(/^mekik-\d+$/);
  });

  it("maps run lifecycle frames to the typing indicator", () => {
    const { connector, typing, messages } = make();
    route(connector, { type: "run", data: { status: "started" } });
    route(connector, { type: "run", data: { status: "finished" } });
    route(connector, { type: "run" });
    expect(typing).toEqual([true, false, false]);
    expect(messages).toHaveLength(0);
  });

  it("maps typing frames to the typing indicator", () => {
    const { connector, typing } = make();
    route(connector, { type: "typing", isTyping: true });
    route(connector, { type: "typing", isTyping: false });
    expect(typing).toEqual([true, false]);
  });

  it("drops malformed tool_call / genui / genui_components frames instead of rendering them", () => {
    const { connector, messages, chunks } = make();
    const toolCalls: unknown[] = [];
    connector.onToolCall((t) => toolCalls.push(t));
    route(connector, { type: "tool_call", data: { id: "t1" } });
    route(connector, { type: "genui", streamId: "", chunk: {} });
    route(connector, { type: "genui_components", components: [] });
    expect(messages).toHaveLength(0);
    expect(chunks).toHaveLength(0);
    expect(toolCalls).toHaveLength(0);
  });

  it("routes a genui chunk to onGenUIChunk with its done flag", () => {
    const { connector, chunks } = make();
    route(connector, { type: "genui", streamId: "s1", chunk: { type: "text", content: "x", id: 1 }, done: true });
    expect(chunks).toEqual([{ streamId: "s1", chunk: { type: "text", content: "x", id: 1 }, done: true }]);
  });

  it("publishes a catalog frame without a hash but does not cache it", () => {
    const map = stubStorage();
    const { connector } = make();
    const seen: unknown[] = [];
    connector.onGenUIComponents((d) => seen.push(d));
    route(connector, { type: "genui_components", components: [{ name: "c", template: "<p></p>" }] });
    expect(seen).toHaveLength(1);
    expect(map.size).toBe(0);
  });

  it("a quick-reply text frame clears typing", () => {
    const { connector, typing, messages } = make();
    route(connector, { type: "text", from: "bot", data: { text: "?" }, actions: [{ label: "A" }] });
    expect(typing).toEqual([false]);
    expect(messages[0].type).toBe("quick-reply");
  });

  it("works with no handlers registered at all", () => {
    const connector = new MekikConnector({ url: "ws://test", reconnect: false });
    for (const frame of [
      "raw",
      { type: "error", data: { code: "busy" } },
      { type: "run", data: { status: "started" } },
      { type: "typing", isTyping: true },
      { type: "tool_call", data: { id: "t", name: "n", status: "running" } },
      { type: "genui", streamId: "s", chunk: { type: "text" } },
      { type: "text", from: "bot", data: { text: "?" }, actions: [{ label: "A" }] },
      { type: "text", from: "bot", data: { text: "hi" } },
      { type: "interrupt", id: "i1", data: { ui: { component: "form" } } },
    ]) {
      expect(() => route(connector, frame)).not.toThrow();
    }
  });
});

// ── error frames ────────────────────────────────────────────────────────

describe("MekikConnector error frames", () => {
  it("a non-auth protocol error clears typing but keeps the connection and fires no auth error", async () => {
    const onAuthError = vi.fn();
    const { connector, typing, messages } = make({ onAuthError });
    const disconnects: unknown[] = [];
    connector.onDisconnect((r) => disconnects.push(r));
    const ws = await connectOpen(connector);

    ws.receive({ type: "error", data: { code: "busy", message: "run in flight" } });
    expect(onAuthError).not.toHaveBeenCalled();
    expect(connector.authError).toBeNull();
    expect(disconnects).toEqual([]);
    expect(typing).toEqual([false]);
    expect(messages).toHaveLength(0);
    expect(ws.readyState).toBe(MockWebSocket.OPEN);
  });

  it("an error frame without data is treated as a generic error", () => {
    const onAuthError = vi.fn();
    const { connector } = make({ onAuthError });
    route(connector, { type: "error" });
    expect(onAuthError).not.toHaveBeenCalled();
  });

  it("an unauthorized frame with no message reports an empty message and notifies onDisconnect", () => {
    const onAuthError = vi.fn();
    const { connector } = make({ onAuthError });
    const disconnects: unknown[] = [];
    connector.onDisconnect((r) => disconnects.push(r));
    route(connector, { type: "error", data: { code: "unauthorized" } });
    expect(onAuthError).toHaveBeenCalledWith({ code: "unauthorized", message: "" });
    expect(disconnects).toEqual([""]);
  });
});

// ── auth rejection handling ─────────────────────────────────────────────

describe("MekikConnector auth rejection", () => {
  it("consults onReject with a fallback context when no attempt is in flight", async () => {
    const onReject = vi.fn(() => "fail" as const);
    const provider: MekikAuthProvider = { name: "test", authenticate: () => ({}), onReject };
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, auth: provider });
    route(connector, { type: "error", data: { code: "unauthorized", message: "no" } });
    await flush();
    expect(onReject).toHaveBeenCalledWith(
      { code: "unauthorized", message: "no" },
      { url: "ws://test", attempt: 0, previousError: null },
    );
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("treats an onReject that throws as 'fail' (no retry)", async () => {
    const provider: MekikAuthProvider = {
      name: "test",
      authenticate: () => ({ token: "t" }),
      onReject: () => {
        throw new Error("cannot decide");
      },
    };
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, auth: provider });
    const ws = await connectOpen(connector);
    ws.receive({ type: "error", data: { code: "unauthorized", message: "bad" } });
    await flush();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("does not retry when disconnect() lands while onReject is deciding", async () => {
    let decide!: (d: "retry") => void;
    const provider: MekikAuthProvider = {
      name: "test",
      authenticate: () => ({ token: "t" }),
      onReject: () => new Promise((r) => (decide = r)),
    };
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, auth: provider });
    const ws = await connectOpen(connector);
    ws.receive({ type: "error", data: { code: "unauthorized", message: "bad" } });
    await flush();
    await connector.disconnect();
    decide("retry");
    await flush();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("swallows a retry whose authenticate() fails", async () => {
    let calls = 0;
    const provider: MekikAuthProvider = {
      name: "test",
      authenticate: () => {
        calls++;
        if (calls > 1) throw new Error("mint failed");
        return { token: "t" };
      },
      onReject: () => "retry",
    };
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, auth: provider });
    const ws = await connectOpen(connector);
    ws.receive({ type: "error", data: { code: "unauthorized", message: "bad" } });
    await flush();
    expect(calls).toBe(2);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("a close with code 4401 suppresses auto-reconnect even without an error frame", async () => {
    vi.useFakeTimers();
    const connector = new MekikConnector({ url: "ws://test", reconnectDelay: 10 });
    const ws = await connectOpen(connector);
    ws.serverClose("unauthorized", 4401);
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});

describe("auth adapters (direct)", () => {
  it("TokenAuth contributes no credential for an empty token", async () => {
    const auth = new TokenAuth({ token: () => "" });
    expect(await auth.authenticate({ url: "ws://x", attempt: 0, previousError: null })).toEqual({});
  });

  it("CookieAuth without refresh never retries", async () => {
    const auth = new CookieAuth();
    expect(
      await auth.onReject({ code: "unauthorized", message: "" }, { url: "ws://x", attempt: 0, previousError: null }),
    ).toBe("fail");
  });
});

// ── socket lifecycle ────────────────────────────────────────────────────

describe("MekikConnector socket lifecycle edge cases", () => {
  it("connect() rejects when the socket errors before opening", async () => {
    const connector = new MekikConnector({ url: "ws://test", reconnect: false });
    const p = connector.connect();
    MockWebSocket.instances[0].onerror?.({ type: "error" });
    await expect(p).rejects.toThrow(/MekikConnector WebSocket error/);
  });

  it("passes protocols through and fires onConnect / onDisconnect", async () => {
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, protocols: ["mekik.v1"] });
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    const typing: boolean[] = [];
    connector.onConnect(onConnect);
    connector.onDisconnect(onDisconnect);
    connector.onTyping((t) => typing.push(t));
    const ws = await connectOpen(connector);
    expect(ws.protocols).toEqual(["mekik.v1"]);
    expect(onConnect).toHaveBeenCalledTimes(1);
    ws.serverClose("bye");
    expect(onDisconnect).toHaveBeenCalledWith("bye");
    // A dropped socket never leaves typing stuck on.
    expect(typing).toEqual([false]);
  });

  it("an explicit connect() while a reconnect is scheduled cancels the timer", async () => {
    vi.useFakeTimers();
    const connector = new MekikConnector({ url: "ws://test", reconnectDelay: 50 });
    const ws = await connectOpen(connector);
    ws.serverClose(); // schedules reconnect
    const p = connector.connect();
    MockWebSocket.instances[1].open();
    await p;
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it("a scheduled reconnect is a no-op once the connector was closed by the user", async () => {
    vi.useFakeTimers();
    const connector = new MekikConnector({ url: "ws://test", reconnectDelay: 10 });
    const ws = await connectOpen(connector);
    ws.serverClose();
    internals(connector).closedByUser = true;
    vi.advanceTimersByTime(10);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("a failing auto-reconnect is swallowed (no unhandled rejection)", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const provider: MekikAuthProvider = {
      name: "test",
      authenticate: () => {
        calls++;
        if (calls > 1) return Promise.reject(new Error("offline"));
        return {};
      },
    };
    const connector = new MekikConnector({ url: "ws://test", reconnectDelay: 10, auth: provider });
    const ws = await connectOpen(connector);
    ws.serverClose();
    vi.advanceTimersByTime(10);
    await flush();
    expect(calls).toBe(2);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("stops auto-reconnecting after maxReconnectAttempts", async () => {
    vi.useFakeTimers();
    const connector = new MekikConnector({ url: "ws://test", reconnectDelay: 10, maxReconnectAttempts: 2 });
    const ws = await connectOpen(connector);
    ws.serverClose();
    vi.advanceTimersByTime(10);
    MockWebSocket.instances[1].serverClose();
    vi.advanceTimersByTime(10);
    MockWebSocket.instances[2].serverClose();
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it("exponential backoff grows the delay with full jitter, capped at reconnectMaxDelay", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(1); // upper end of the jitter window
    const connector = new MekikConnector({
      url: "ws://test",
      reconnectDelay: 100,
      reconnectBackoff: "exponential",
      reconnectMaxDelay: 300,
      maxReconnectAttempts: 10,
    });
    await connectOpen(connector);

    // 1st retry: raw = 100
    MockWebSocket.instances[0].serverClose();
    vi.advanceTimersByTime(99);
    expect(MockWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(2);

    // 2nd retry (socket never opened, so attempts keep counting): raw = 200
    MockWebSocket.instances[1].serverClose();
    vi.advanceTimersByTime(199);
    expect(MockWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(3);

    // 3rd retry: raw = min(400, 300) = 300
    MockWebSocket.instances[2].serverClose();
    vi.advanceTimersByTime(299);
    expect(MockWebSocket.instances).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(4);
  });

  it("exponential backoff's lower jitter bound is half the raw delay", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const connector = new MekikConnector({ url: "ws://test", reconnectDelay: 100, reconnectBackoff: "exponential" });
    await connectOpen(connector);
    MockWebSocket.instances[0].serverClose();
    vi.advanceTimersByTime(49);
    expect(MockWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it("routeInUrl puts conversationId and userId in the connect URL", async () => {
    const connector = new MekikConnector({
      url: "ws://test/chat",
      reconnect: false,
      routeInUrl: true,
      userId: "u1",
      conversationId: "c1",
    });
    const ws = await connectOpen(connector);
    const url = new URL(ws.url);
    expect(url.searchParams.get("conversationId")).toBe("c1");
    expect(url.searchParams.get("userId")).toBe("u1");
  });

  it("routeInUrl with no known ids leaves the URL untouched", async () => {
    const connector = new MekikConnector({ url: "ws://test/chat", reconnect: false, routeInUrl: true });
    const ws = await connectOpen(connector);
    expect(ws.url).toBe("ws://test/chat");
  });

  it("a query credential wins over routing keys on a clash", async () => {
    const connector = new MekikConnector({
      url: "ws://test/chat",
      reconnect: false,
      routeInUrl: true,
      userId: "u1",
      auth: new TokenAuth({ token: "secret", transport: "query", queryParam: "userId" }),
    });
    const ws = await connectOpen(connector);
    expect(new URL(ws.url).searchParams.get("userId")).toBe("secret");
  });
});

// ── offline queue ───────────────────────────────────────────────────────

describe("MekikConnector offline queue", () => {
  it("rejects sends while offline when queueOfflineMessages is false", async () => {
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, queueOfflineMessages: false });
    await expect(connector.sendMessage({ id: "m", type: "text", data: { text: "x" } })).rejects.toThrow(
      "MekikConnector: not connected.",
    );
  });

  it("flushes several queued payloads in order after hello", async () => {
    const connector = new MekikConnector({ url: "ws://test", reconnect: false });
    const a = connector.sendMessage({ id: "a", type: "text", data: { text: "first" } });
    const b = connector.sendSurvey({ rating: 4, comment: "ok" } as never);
    const ws = await connectOpen(connector);
    await Promise.all([a, b]);
    const frames = ws.frames();
    expect(frames.map((f) => f.type)).toEqual(["hello", "text", "survey"]);
    expect(frames[2]).toMatchObject({ type: "survey", rating: 4, comment: "ok" });
    expect(internals(connector).queue).toHaveLength(0);
  });

  it("sends a survey straight away when connected", async () => {
    const connector = new MekikConnector({ url: "ws://test", reconnect: false });
    const ws = await connectOpen(connector);
    await connector.sendSurvey({ rating: 1 } as never);
    expect(ws.frames()[1]).toMatchObject({ type: "survey", rating: 1 });
  });
});

// ── interrupts (mekik/2 §4) ─────────────────────────────────────────────

describe("MekikConnector interrupts", () => {
  it("ignores an interrupt without an id", () => {
    const { connector, messages } = make();
    route(connector, { type: "interrupt", data: { payload: { title: "?" } } });
    expect(messages).toHaveLength(0);
  });

  it("renders default chips with the fallback prompt for an interrupt without data", () => {
    const { connector, messages } = make();
    route(connector, { type: "interrupt", id: "i1" });
    expect((messages[0].data as Record<string, unknown>).text).toBe("Approval required");
  });

  it("picks the first human-readable payload field for the prompt", () => {
    const { connector, messages } = make();
    route(connector, { type: "interrupt", id: "i1", data: { payload: { title: "", question: "Really?" } } });
    expect((messages[0].data as Record<string, unknown>).text).toBe("Really?");
  });

  it("mounts an interrupt ui component as a GenUI chunk carrying the interrupt id", () => {
    const { connector, chunks, messages } = make();
    route(connector, {
      type: "interrupt",
      id: "i1",
      data: { ui: { component: "approval-form", props: { amount: 5 } } },
    });
    route(connector, { type: "interrupt", id: "i2", data: { ui: { component: "plain-form", props: "bad" } } });
    expect(messages).toHaveLength(0);
    expect(chunks).toEqual([
      {
        streamId: "interrupt-i1",
        chunk: { type: "ui", component: "approval-form", props: { amount: 5, interruptId: "i1" }, id: 1 },
        done: true,
      },
      {
        streamId: "interrupt-i2",
        chunk: { type: "ui", component: "plain-form", props: { interruptId: "i2" }, id: 1 },
        done: true,
      },
    ]);
  });

  it("answers a chip without a value with its label, and resolves once sent on an open socket", async () => {
    const { connector } = make();
    const ws = await connectOpen(connector);
    ws.receive({ type: "interrupt", id: "i1", data: { actions: [{ label: "Yes" }, { label: "No" }] } });
    await connector.sendMessage({ id: "m", type: "text", data: { text: "No" } });
    expect(ws.frames()[1]).toEqual({ type: "resume", answers: { i1: "No" } });
    // The interrupt is consumed — the next message is a normal turn.
    await connector.sendMessage({ id: "m2", type: "text", data: { text: "No" } });
    expect(ws.frames()[2].type).toBe("text");
  });

  it("free text resumes the single open interrupt", async () => {
    const { connector } = make();
    const ws = await connectOpen(connector);
    ws.receive({ type: "interrupt", id: "i1", data: { payload: { title: "Reason?" } } });
    await connector.sendMessage({ id: "m", type: "text", data: { text: "because" } });
    expect(ws.frames()[1]).toEqual({ type: "resume", answers: { i1: "because" } });
  });

  it("free text with several open interrupts is sent as a normal turn", async () => {
    const { connector } = make();
    const ws = await connectOpen(connector);
    ws.receive({ type: "interrupt", id: "i1", data: { payload: { title: "A?" } } });
    ws.receive({ type: "interrupt", id: "i2", data: { payload: { title: "B?" } } });
    await connector.sendMessage({ id: "m", type: "text", data: { text: "hmm" } });
    expect(ws.frames()[1]).toMatchObject({ type: "text", data: { text: "hmm" } });
  });

  it("a message without text is never a resume", async () => {
    const { connector } = make();
    const ws = await connectOpen(connector);
    ws.receive({ type: "interrupt", id: "i1", data: { payload: { title: "A?" } } });
    await connector.sendMessage({ id: "m", type: "image", data: { url: "x.png" } } as never);
    expect(ws.frames()[1]).toMatchObject({ type: "image" });
  });

  it("interrupt_resolved without an id is harmless", () => {
    const { connector } = make();
    expect(() => route(connector, { type: "interrupt_resolved" })).not.toThrow();
  });
});

// ── client tools corner cases ───────────────────────────────────────────

describe("MekikConnector client tools edge cases", () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it("a later declaration of the same name replaces the earlier one", async () => {
    const first = vi.fn();
    const second = vi.fn(() => "v2");
    const connector = new MekikConnector({
      url: "ws://test",
      reconnect: false,
      tools: [
        { name: "pick", description: "old", handler: first },
        { name: "other", handler: vi.fn() },
        { name: "pick", description: "new", handler: second },
      ],
    });
    expect(connector.clientTools.map((t) => [t.name, t.description])).toEqual([
      ["pick", "new"],
      ["other", undefined],
    ]);
    const ws = await connectOpen(connector);
    ws.receive({ type: "interrupt", id: "c1", data: { tool: { name: "pick" } } });
    await tick();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(undefined);
  });

  it("a handler returning undefined answers {ok:true} with no result field", async () => {
    const connector = new MekikConnector({
      url: "ws://test",
      reconnect: false,
      tools: [{ name: "noop", handler: () => undefined }],
    });
    const ws = await connectOpen(connector);
    ws.receive({ type: "interrupt", id: "c1", data: { tool: { name: "noop", params: { a: 1 } } } });
    await tick();
    expect(ws.frames()[1]).toEqual({ type: "resume", answers: { c1: { ok: true } } });
  });

  it("a handler throwing a non-Error answers with its string form", async () => {
    const connector = new MekikConnector({
      url: "ws://test",
      reconnect: false,
      tools: [
        {
          name: "bad",
          handler: () => {
            throw "plain string failure";
          },
        },
      ],
    });
    const ws = await connectOpen(connector);
    ws.receive({ type: "interrupt", id: "c1", data: { tool: { name: "bad" } } });
    await tick();
    expect(ws.frames()[1]).toEqual({ type: "resume", answers: { c1: { ok: false, error: "plain string failure" } } });
  });

  it("unregisterTool of an unknown name is a silent no-op", async () => {
    const connector = new MekikConnector({
      url: "ws://test",
      reconnect: false,
      allowDynamicTools: true,
      tools: [{ name: "a", handler: vi.fn() }],
    });
    const ws = await connectOpen(connector);
    connector.unregisterTool("missing");
    expect(ws.frames().filter((f) => f.type === "client_tools")).toHaveLength(0);
    expect(connector.clientTools).toHaveLength(1);
  });

  it("registerTool while offline updates the set without sending (hello re-declares it)", async () => {
    const connector = new MekikConnector({ url: "ws://test", reconnect: false, allowDynamicTools: true });
    connector.registerTool({ name: "late", handler: vi.fn() });
    const ws = await connectOpen(connector);
    expect(ws.frames()[0]).toMatchObject({ type: "hello", tools: [{ name: "late" }] });
    expect(ws.frames().filter((f) => f.type === "client_tools")).toHaveLength(0);
  });

  it("claims malformed client_tool notify chunks without firing anything", async () => {
    const handler = vi.fn();
    const { connector, chunks } = make({ tools: [{ name: "beep", mode: "notify", handler }] });
    route(connector, { type: "genui", streamId: "s", chunk: { type: "event", name: "client_tool" } });
    route(connector, { type: "genui", streamId: "s", chunk: { type: "event", name: "client_tool", payload: { name: 5 } } });
    await tick();
    expect(handler).not.toHaveBeenCalled();
    expect(chunks).toHaveLength(0);
  });

  it("a notify chunk for an unknown tool is claimed and dropped; a rejecting handler is swallowed", async () => {
    const handler = vi.fn(() => Promise.reject(new Error("nope")));
    const { connector, chunks } = make({ tools: [{ name: "beep", mode: "notify", handler }] });
    route(connector, {
      type: "genui",
      streamId: "s",
      chunk: { type: "event", name: "client_tool", payload: { name: "unknown" } },
    });
    route(connector, {
      type: "genui",
      streamId: "s",
      chunk: { type: "event", name: "client_tool", id: 2, payload: { name: "beep", params: "not-an-object" } },
    });
    await tick();
    expect(chunks).toHaveLength(0);
    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it("non-client_tool event chunks still reach the GenUI layer", () => {
    const { connector, chunks } = make();
    route(connector, { type: "genui", streamId: "s", chunk: { type: "event", name: "other" } });
    expect(chunks).toHaveLength(1);
  });
});
