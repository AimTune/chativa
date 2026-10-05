import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SseConnector } from "../SseConnector";
import type { IncomingMessage, GenUIEventOptions } from "@chativa/core";

type Listener = (ev: { data: string }) => void;

/** EventSource stub that keeps every listener so tests can fire named events. */
class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: MockEventSource[] = [];

  readyState = MockEventSource.CONNECTING;
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: Listener | null = null;
  listeners = new Map<string, Listener>();
  close = vi.fn(() => {
    this.readyState = MockEventSource.CLOSED;
  });

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: Listener): void {
    this.listeners.set(type, handler);
  }

  open(): void {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.();
  }

  fail(state: number): void {
    this.readyState = state;
    this.onerror?.();
  }

  emit(type: string, data: string): void {
    this.listeners.get(type)?.({ data });
  }
}

const URL_ = "http://test/stream";
let fetchMock: ReturnType<typeof vi.fn>;
let respond: () => Response | Promise<Response>;

function calls(): Array<[string, RequestInit]> {
  return fetchMock.mock.calls as Array<[string, RequestInit]>;
}

function make(opts: Partial<ConstructorParameters<typeof SseConnector>[0]> = {}) {
  const connector = new SseConnector({ url: URL_, ...opts });
  const messages: IncomingMessage[] = [];
  const disconnects: Array<string | undefined> = [];
  const typing: boolean[] = [];
  let connects = 0;
  connector.onMessage((m) => messages.push(m));
  connector.onDisconnect((r) => disconnects.push(r));
  connector.onTyping((t) => typing.push(t));
  connector.onConnect(() => connects++);
  return { connector, messages, disconnects, typing, connects: () => connects };
}

/** Start connect() and hand back the EventSource it created. */
function start(connector: SseConnector) {
  const p = connector.connect();
  const es = MockEventSource.instances.at(-1)!;
  return { p, es };
}

describe("SseConnector lifecycle and transport", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
    respond = () => new Response("{}", { status: 200 });
    fetchMock = vi.fn(() => Promise.resolve(respond()));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("exposes its name and addSentToHistory flag", () => {
    const { connector } = make();
    expect(connector.name).toBe("sse");
    expect(connector.addSentToHistory).toBe(true);
  });

  describe("connect", () => {
    it("opens an EventSource on the configured url and resolves on open", async () => {
      const { connector, connects } = make();
      const { p, es } = start(connector);
      expect(es.url).toBe(URL_);
      es.open();
      await expect(p).resolves.toBeUndefined();
      expect(connects()).toBe(1);
    });

    it("resolves on a named `connected` event", async () => {
      const { connector, connects } = make();
      const { p, es } = start(connector);
      es.emit("connected", "");
      await expect(p).resolves.toBeUndefined();
      expect(connects()).toBe(1);
    });

    it("rejects when the stream errors before opening", async () => {
      const { connector, disconnects } = make();
      const { p, es } = start(connector);
      es.fail(MockEventSource.CONNECTING);
      await expect(p).rejects.toThrow("SseConnector: failed to open SSE connection.");
      expect(disconnects).toEqual([]);
    });

    it("reports an error disconnect when the stream is CLOSED, keeping the source when reconnect is on", async () => {
      const { connector, disconnects } = make();
      const { p, es } = start(connector);
      es.fail(MockEventSource.CLOSED);
      await expect(p).rejects.toThrow();
      expect(disconnects).toEqual(["error"]);

      // reconnect=true keeps the EventSource reference, so disconnect closes it.
      await connector.disconnect();
      expect(es.close).toHaveBeenCalledTimes(1);
    });

    it("drops the source on a CLOSED error when reconnect is disabled", async () => {
      const { connector, disconnects } = make({ reconnect: false });
      const { p, es } = start(connector);
      es.fail(MockEventSource.CLOSED);
      await expect(p).rejects.toThrow();
      expect(disconnects).toEqual(["error"]);

      await connector.disconnect();
      expect(es.close).not.toHaveBeenCalled();
      expect(disconnects).toEqual(["error", "user"]);
    });

    it("works without any handlers registered", async () => {
      const connector = new SseConnector({ url: URL_ });
      const { p, es } = start(connector);
      es.open();
      await p;
      es.onmessage?.({ data: "plain" });
      es.onmessage?.({ data: JSON.stringify({ type: "connected" }) });
      es.onmessage?.({ data: JSON.stringify({ id: "m", type: "text", data: { text: "x" } }) });
      es.emit("typing", JSON.stringify({ isTyping: true }));
      es.fail(MockEventSource.CLOSED);
      await connector.disconnect();
    });
  });

  describe("after the first message", () => {
    async function live(opts: Partial<ConstructorParameters<typeof SseConnector>[0]> = {}) {
      const ctx = make(opts);
      const { p, es } = start(ctx.connector);
      es.open();
      await p;
      es.onmessage?.({ data: JSON.stringify({ id: "m0", type: "text", data: { text: "hi" } }) });
      return { ...ctx, es };
    }

    it("reports an error disconnect only when the stream is CLOSED", async () => {
      const { es, disconnects } = await live();
      es.fail(MockEventSource.CONNECTING); // transient: browser is retrying
      expect(disconnects).toEqual([]);
      es.fail(MockEventSource.CLOSED);
      expect(disconnects).toEqual(["error"]);
    });

    it("falls back to a text message for non-JSON data", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(1_700_000_000_000);
      const { es, messages } = await live();
      es.onmessage?.({ data: "just text" });

      expect(messages.at(-1)).toEqual({
        id: "sse-1700000000000",
        type: "text",
        data: { text: "just text" },
        timestamp: 1_700_000_000_000,
      });
    });

    it("ignores JSON objects that are neither frames nor messages", async () => {
      const { es, messages } = await live();
      es.onmessage?.({ data: JSON.stringify({ type: "text" }) }); // no id
      es.onmessage?.({ data: JSON.stringify({ id: "x" }) }); // no type
      expect(messages.map((m) => m.id)).toEqual(["m0"]);
    });

    it("fires onConnect for a `connected` data frame", async () => {
      const { es, connects } = await live();
      es.onmessage?.({ data: JSON.stringify({ type: "connected" }) });
      expect(connects()).toBe(2);
    });

    it("swallows genui_components frames", async () => {
      const { es, messages } = await live();
      es.onmessage?.({
        data: JSON.stringify({
          type: "genui_components",
          id: "g1",
          components: [{ name: "card", template: "<p></p>" }],
        }),
      });
      expect(messages.map((m) => m.id)).toEqual(["m0"]);
    });
  });

  describe("named event listeners", () => {
    it("handles JSON on the `message` listener and ignores invalid JSON", async () => {
      const { connector, messages } = make();
      const { p, es } = start(connector);
      es.open();
      await p;

      es.emit("message", JSON.stringify({ id: "n1", type: "text", data: { text: "a" } }));
      es.emit("message", "not json");
      expect(messages.map((m) => m.id)).toEqual(["n1"]);
    });

    it("maps the `typing` event, defaulting isTyping to false, and ignores invalid JSON", async () => {
      const { connector, typing } = make();
      const { p, es } = start(connector);
      es.open();
      await p;

      es.emit("typing", JSON.stringify({ isTyping: true }));
      es.emit("typing", JSON.stringify({}));
      es.emit("typing", "{bad");
      expect(typing).toEqual([true, false]);
    });
  });

  describe("disconnect", () => {
    it("closes the EventSource and reports a user disconnect", async () => {
      const { connector, disconnects } = make();
      const { p, es } = start(connector);
      es.open();
      await p;

      await connector.disconnect();
      expect(es.close).toHaveBeenCalledTimes(1);
      expect(disconnects).toEqual(["user"]);

      // A second disconnect has no source left to close.
      await connector.disconnect();
      expect(es.close).toHaveBeenCalledTimes(1);
    });

    it("is safe without connecting or handlers", async () => {
      await expect(new SseConnector({ url: URL_ }).disconnect()).resolves.toBeUndefined();
    });

    it("can reconnect with a fresh EventSource", async () => {
      const { connector, connects } = make();
      let s = start(connector);
      s.es.open();
      await s.p;
      await connector.disconnect();
      s = start(connector);
      s.es.open();
      await s.p;

      expect(MockEventSource.instances).toHaveLength(2);
      expect(connects()).toBe(2);
    });
  });

  describe("sendMessage", () => {
    const msg = { id: "o1", type: "text", data: { text: "hi" } };

    it("POSTs JSON to the stream url when no sendUrl is configured", async () => {
      const { connector } = make({ headers: { Authorization: "Bearer t" } });
      await connector.sendMessage(msg);

      const [url, init] = calls()[0];
      expect(url).toBe(URL_);
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer t" });
      expect(JSON.parse(init.body as string)).toEqual(msg);
    });

    it("POSTs to sendUrl when configured", async () => {
      const { connector } = make({ sendUrl: "http://test/send" });
      await connector.sendMessage(msg);
      expect(calls()[0][0]).toBe("http://test/send");
    });

    it("rejects on a non-2xx response", async () => {
      respond = () => new Response("", { status: 502, statusText: "Bad Gateway" });
      const { connector } = make();
      await expect(connector.sendMessage(msg)).rejects.toThrow("SseConnector: HTTP 502 Bad Gateway");
    });
  });

  describe("sendSurvey", () => {
    it("POSTs the payload tagged as type survey", async () => {
      const { connector } = make({ sendUrl: "http://test/send", headers: { "X-K": "v" } });
      await connector.sendSurvey({ rating: 4, comment: "ok", kind: "end_of_conversation" });

      const [url, init] = calls()[0];
      expect(url).toBe("http://test/send");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/json", "X-K": "v" });
      expect(JSON.parse(init.body as string)).toEqual({
        type: "survey",
        rating: 4,
        comment: "ok",
        kind: "end_of_conversation",
      });
    });

    it("rejects on a non-2xx response", async () => {
      respond = () => new Response("", { status: 500, statusText: "ISE" });
      const { connector } = make();
      await expect(connector.sendSurvey({ rating: 1 })).rejects.toThrow("SseConnector: HTTP 500 ISE");
    });
  });

  describe("loadHistory", () => {
    it("GETs {url}/history, stripping trailing slashes, and returns the JSON body", async () => {
      const page = { messages: [{ id: "h1", type: "text", data: { text: "old" } }], hasMore: false };
      respond = () => new Response(JSON.stringify(page), { status: 200 });
      const { connector } = make({ url: "http://test/stream//", headers: { "X-K": "v" } });

      await expect(connector.loadHistory()).resolves.toEqual(page);
      expect(calls()[0][0]).toBe("http://test/stream/history");
      expect(calls()[0][1].headers).toEqual({ "X-K": "v" });
    });

    it("URL-encodes the cursor", async () => {
      respond = () => new Response(JSON.stringify({ messages: [], hasMore: false }), { status: 200 });
      const { connector } = make();
      await connector.loadHistory("a/b c");
      expect(calls()[0][0]).toBe(`${URL_}/history?cursor=a%2Fb%20c`);
    });

    it("rejects on a non-2xx response", async () => {
      respond = () => new Response("", { status: 404, statusText: "Not Found" });
      const { connector } = make();
      await expect(connector.loadHistory()).rejects.toThrow("SseConnector: HTTP 404 Not Found");
    });
  });

  describe("receiveComponentEvent", () => {
    it("includes routing opts and custom headers", () => {
      const { connector } = make({ headers: { "X-K": "v" } });
      const opts: GenUIEventOptions = { scope: "graph", component: "card" };
      connector.receiveComponentEvent("s1", "action", { v: 1 }, opts);

      const [url, init] = calls()[0];
      expect(url).toBe(URL_);
      expect(init.headers).toEqual({ "Content-Type": "application/json", "X-K": "v" });
      expect(JSON.parse(init.body as string)).toEqual({
        type: "genui_event",
        streamId: "s1",
        eventType: "action",
        payload: { v: 1 },
        scope: "graph",
        component: "card",
      });
    });

    it("swallows a network failure", async () => {
      fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError("offline")));
      const { connector } = make();
      expect(() => connector.receiveComponentEvent("s1", "submit", {})).not.toThrow();
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
