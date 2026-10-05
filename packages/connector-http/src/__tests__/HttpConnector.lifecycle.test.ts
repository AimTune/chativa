import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpConnector } from "../HttpConnector";
import type { IncomingMessage, GenUIEventOptions } from "@chativa/core";

type Responder = (url: string, init: RequestInit) => Response | Promise<Response>;

const BASE = "http://test/api";

let responder: Responder;
let fetchMock: ReturnType<typeof vi.fn>;

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function calls(): Array<[string, RequestInit]> {
  return fetchMock.mock.calls as Array<[string, RequestInit]>;
}

function make(opts: Partial<ConstructorParameters<typeof HttpConnector>[0]> = {}) {
  const connector = new HttpConnector({ url: BASE, pollInterval: 10, ...opts });
  const messages: IncomingMessage[] = [];
  const disconnects: Array<string | undefined> = [];
  let connects = 0;
  connector.onMessage((m) => messages.push(m));
  connector.onDisconnect((r) => disconnects.push(r));
  connector.onConnect(() => connects++);
  return { connector, messages, disconnects, connects: () => connects };
}

describe("HttpConnector lifecycle and transport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    responder = () => ok({ messages: [] });
    fetchMock = vi.fn((url: string, init: RequestInit) => Promise.resolve(responder(url, init)));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("exposes its name and addSentToHistory flag", () => {
    const { connector } = make();
    expect(connector.name).toBe("http");
    expect(connector.addSentToHistory).toBe(true);
  });

  describe("connect", () => {
    it("probes GET {url}/messages, fires onConnect and starts polling", async () => {
      const { connector, connects } = make();
      await connector.connect();

      expect(connects()).toBe(1);
      expect(calls()).toHaveLength(1);
      expect(calls()[0][0]).toBe(`${BASE}/messages`);
      expect(calls()[0][1].method).toBe("GET");

      await vi.advanceTimersByTimeAsync(10);
      expect(calls()).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(10);
      expect(calls()).toHaveLength(3);
      await connector.disconnect();
    });

    it("rejects without firing onConnect or polling when the probe returns non-2xx", async () => {
      responder = () => new Response("nope", { status: 503, statusText: "Service Unavailable" });
      const { connector, connects } = make();

      await expect(connector.connect()).rejects.toThrow("HttpConnector: HTTP 503 Service Unavailable");
      expect(connects()).toBe(0);

      await vi.advanceTimersByTimeAsync(100);
      expect(calls()).toHaveLength(1);
    });

    it("rejects when fetch itself fails (network error)", async () => {
      responder = () => {
        throw new TypeError("Failed to fetch");
      };
      const { connector } = make();
      await expect(connector.connect()).rejects.toThrow("Failed to fetch");
    });

    it("sends JSON content-type plus custom headers", async () => {
      const { connector } = make({ headers: { Authorization: "Bearer t" } });
      await connector.connect();

      expect(calls()[0][1].headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer t",
      });
      await connector.disconnect();
    });

    it("lets custom headers override the default content-type", async () => {
      const { connector } = make({ headers: { "Content-Type": "text/plain" } });
      await connector.connect();
      expect((calls()[0][1].headers as Record<string, string>)["Content-Type"]).toBe("text/plain");
      await connector.disconnect();
    });

    it("uses the default 2000 ms poll interval when none is given", async () => {
      const connector = new HttpConnector({ url: BASE });
      await connector.connect();

      await vi.advanceTimersByTimeAsync(1999);
      expect(calls()).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(calls()).toHaveLength(2);
      await connector.disconnect();
    });
  });

  describe("disconnect", () => {
    it("stops polling and reports a user disconnect", async () => {
      const { connector, disconnects } = make();
      await connector.connect();
      await connector.disconnect();

      expect(disconnects).toEqual(["user"]);
      await vi.advanceTimersByTimeAsync(100);
      expect(calls()).toHaveLength(1);
    });

    it("is safe to call without connecting and without handlers", async () => {
      const connector = new HttpConnector({ url: BASE });
      await expect(connector.disconnect()).resolves.toBeUndefined();
    });

    it("can reconnect after disconnecting", async () => {
      const { connector, connects } = make();
      await connector.connect();
      await connector.disconnect();
      await connector.connect();

      expect(connects()).toBe(2);
      await vi.advanceTimersByTimeAsync(10);
      expect(calls()).toHaveLength(3); // two probes + one poll
      await connector.disconnect();
    });
  });

  describe("polling", () => {
    it("delivers polled messages and follows the returned cursor", async () => {
      const batches: unknown[] = [
        { messages: [{ id: "a", type: "text", data: { text: "1" } }], cursor: "c 1" },
        { messages: [{ id: "b", type: "text", data: { text: "2" } }] },
        { messages: [] },
      ];
      const { connector, messages } = make();
      await connector.connect();
      responder = () => ok(batches.shift() ?? { messages: [] });

      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(10);

      expect(messages.map((m) => m.id)).toEqual(["a", "b"]);
      expect(calls()[1][0]).toBe(`${BASE}/messages`);
      // Cursor is URL-encoded, and kept when a later response omits it.
      expect(calls()[2][0]).toBe(`${BASE}/messages?cursor=c%201`);
      expect(calls()[3][0]).toBe(`${BASE}/messages?cursor=c%201`);
      await connector.disconnect();
    });

    it("tolerates a poll response without a messages array or with an empty body", async () => {
      const { connector, messages, disconnects } = make();
      await connector.connect();

      responder = () => ok({});
      await vi.advanceTimersByTimeAsync(10);
      responder = () => new Response("", { status: 200 });
      await vi.advanceTimersByTimeAsync(10);

      expect(messages).toEqual([]);
      expect(disconnects).toEqual([]);
      await connector.disconnect();
    });

    it("swallows genui_components frames instead of rendering them", async () => {
      const { connector, messages } = make();
      await connector.connect();
      responder = () =>
        ok({
          messages: [
            { type: "genui_components", components: [{ name: "card", template: "<p></p>" }] },
            { id: "x", type: "text", data: { text: "after" } },
          ],
        });
      await vi.advanceTimersByTimeAsync(10);

      expect(messages.map((m) => m.id)).toEqual(["x"]);
      await connector.disconnect();
    });

    it("routes frames silently when no handlers are registered", async () => {
      const connector = new HttpConnector({ url: BASE, pollInterval: 10 });
      await connector.connect();
      responder = () =>
        ok({
          messages: [
            { type: "tool_call", data: { id: "c1", name: "s", status: "running" } },
            { type: "genui", streamId: "s1", chunk: { type: "text", content: "hi", id: 1 }, done: true },
            { type: "typing", isTyping: true },
            { type: "text", id: "m1", data: { text: "Pick" }, actions: [{ label: "A" }] },
            { id: "m2", type: "text", data: { text: "plain" } },
          ],
        });
      await expect(vi.advanceTimersByTimeAsync(10)).resolves.toBeDefined();
      await connector.disconnect();
    });

    it("stops polling and reports an error after maxErrors consecutive failures", async () => {
      const { connector, disconnects } = make({ maxErrors: 3 });
      await connector.connect();
      responder = () => new Response("", { status: 500, statusText: "ISE" });

      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(10);
      expect(disconnects).toEqual([]);
      await vi.advanceTimersByTimeAsync(10);
      expect(disconnects).toEqual(["error"]);

      const count = calls().length;
      await vi.advanceTimersByTimeAsync(100);
      expect(calls()).toHaveLength(count);
    });

    it("resets the error counter after a successful poll", async () => {
      const { connector, disconnects } = make({ maxErrors: 2 });
      await connector.connect();

      const seq = [false, true, false, true, false]; // fail, ok, fail, ok, fail
      responder = () =>
        seq.shift() ? ok({ messages: [] }) : new Response("", { status: 500 });
      for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(10);

      expect(disconnects).toEqual([]);
      await connector.disconnect();
    });

    it("treats malformed JSON in a poll response as an error", async () => {
      const { connector, disconnects } = make({ maxErrors: 1 });
      await connector.connect();
      responder = () => new Response("{not json", { status: 200 });

      await vi.advanceTimersByTimeAsync(10);
      expect(disconnects).toEqual(["error"]);
    });

    it("defaults maxErrors to 5", async () => {
      const { connector, disconnects } = make();
      await connector.connect();
      responder = () => new Response("", { status: 500 });

      for (let i = 0; i < 4; i++) await vi.advanceTimersByTimeAsync(10);
      expect(disconnects).toEqual([]);
      await vi.advanceTimersByTimeAsync(10);
      expect(disconnects).toEqual(["error"]);
    });

    it("issues no further polls after disconnect, even with one in flight", async () => {
      const { connector } = make();
      await connector.connect();

      let release!: (r: Response) => void;
      responder = () => new Promise<Response>((r) => (release = r));
      await vi.advanceTimersByTimeAsync(10); // poll in flight
      await connector.disconnect();
      release(ok({ messages: [{ id: "late", type: "text", data: { text: "x" } }] }));
      await vi.advanceTimersByTimeAsync(0);

      // No further polls are issued after disconnect.
      const count = calls().length;
      await vi.advanceTimersByTimeAsync(100);
      expect(calls()).toHaveLength(count);
    });

    it("skips a tick that fires while stopped", async () => {
      // A tick queued before disconnect() must not fetch once _stopped is set.
      const { connector } = make();
      await connector.connect();
      await connector.disconnect();
      // Re-arm polling without clearing the stopped flag via the private helper.
      (connector as unknown as { _startPolling(): void })._startPolling();
      await vi.advanceTimersByTimeAsync(30);
      expect(calls()).toHaveLength(1);
      (connector as unknown as { _stopPolling(): void })._stopPolling();
    });
  });

  describe("sendMessage", () => {
    it("POSTs the message as JSON to {url}/messages", async () => {
      const { connector } = make({ headers: { "X-K": "v" } });
      const msg = { id: "o1", type: "text", data: { text: "hi" }, timestamp: 1 };
      await connector.sendMessage(msg);

      const [url, init] = calls()[0];
      expect(url).toBe(`${BASE}/messages`);
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual(msg);
      expect(init.headers).toMatchObject({ "Content-Type": "application/json", "X-K": "v" });
    });

    it("rejects on a non-2xx response", async () => {
      responder = () => new Response("", { status: 400, statusText: "Bad Request" });
      const { connector } = make();
      await expect(
        connector.sendMessage({ id: "o1", type: "text", data: { text: "hi" } }),
      ).rejects.toThrow("HttpConnector: HTTP 400 Bad Request");
    });
  });

  describe("sendSurvey", () => {
    it("POSTs the survey payload to {url}/survey", async () => {
      const { connector } = make();
      const payload = { kind: "end_of_conversation", rating: 5, comment: "great" };
      await connector.sendSurvey(payload);

      const [url, init] = calls()[0];
      expect(url).toBe(`${BASE}/survey`);
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual(payload);
    });

    it("rejects on a non-2xx response", async () => {
      responder = () => new Response("", { status: 500, statusText: "ISE" });
      const { connector } = make();
      await expect(
        connector.sendSurvey({ rating: 1 }),
      ).rejects.toThrow("HTTP 500");
    });
  });

  describe("loadHistory", () => {
    it("GETs {url}/history without a cursor and returns the parsed body", async () => {
      const page = { messages: [{ id: "h1", type: "text", data: { text: "old" } }], hasMore: true, cursor: "n" };
      responder = () => ok(page);
      const { connector } = make();

      await expect(connector.loadHistory()).resolves.toEqual(page);
      expect(calls()[0][0]).toBe(`${BASE}/history`);
      expect(calls()[0][1].method).toBe("GET");
    });

    it("URL-encodes the cursor", async () => {
      responder = () => ok({ messages: [], hasMore: false });
      const { connector } = make();
      await connector.loadHistory("a/b c");
      expect(calls()[0][0]).toBe(`${BASE}/history?cursor=a%2Fb%20c`);
    });

    it("rejects on a non-2xx response", async () => {
      responder = () => new Response("", { status: 404, statusText: "Not Found" });
      const { connector } = make();
      await expect(connector.loadHistory()).rejects.toThrow("HTTP 404 Not Found");
    });
  });

  describe("receiveComponentEvent", () => {
    it("forwards opts on the genui_event frame", async () => {
      const { connector } = make();
      connector.receiveComponentEvent("s1", "action", { v: 1 }, { component: "card", scope: "graph" } as GenUIEventOptions);
      await vi.advanceTimersByTimeAsync(0);

      const [url, init] = calls()[0];
      expect(url).toBe(`${BASE}/messages`);
      expect(JSON.parse(init.body as string)).toMatchObject({
        type: "genui_event",
        streamId: "s1",
        eventType: "action",
        payload: { v: 1 },
        scope: "graph",
        component: "card",
      });
    });

    it("swallows a failed POST", async () => {
      responder = () => new Response("", { status: 500 });
      const { connector, disconnects } = make();
      expect(() => connector.receiveComponentEvent("s1", "submit", {})).not.toThrow();
      await vi.advanceTimersByTimeAsync(0);
      expect(disconnects).toEqual([]);
    });
  });
});
