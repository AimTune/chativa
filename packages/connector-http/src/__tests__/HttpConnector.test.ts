import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpConnector } from "../HttpConnector";
import type { ToolCall, AIChunk, IncomingMessage } from "@chativa/core";

/** Queue of poll batches the stubbed GET {url}/messages hands back in order. */
let batches: unknown[][] = [];

function stubFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "GET" && String(url).includes("/messages")) {
      const messages = batches.shift() ?? [];
      return new Response(JSON.stringify({ messages }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
}

async function connected() {
  const connector = new HttpConnector({ url: "http://test/api", pollInterval: 5 });
  const messages: IncomingMessage[] = [];
  const toolCalls: ToolCall[] = [];
  const genui: Array<{ streamId: string; chunk: AIChunk; done: boolean }> = [];
  const typing: boolean[] = [];
  connector.onMessage((m) => messages.push(m));
  connector.onToolCall((tc) => toolCalls.push(tc));
  connector.onGenUIChunk((streamId, chunk, done) => genui.push({ streamId, chunk, done }));
  connector.onTyping((t) => typing.push(t));

  await connector.connect();
  return { connector, messages, toolCalls, genui, typing };
}

/** Let one poll tick fire and its async handler settle. */
async function poll(): Promise<void> {
  await vi.advanceTimersByTimeAsync(6);
}

describe("HttpConnector frame routing", () => {
  beforeEach(() => {
    batches = [];
    vi.useFakeTimers();
    vi.stubGlobal("fetch", stubFetch());
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("routes rich frames out of a poll batch and passes plain messages through", async () => {
    const { connector, messages, toolCalls, genui, typing } = await connected();

    // Enqueued after connect(): connect does its own reachability GET against
    // /messages, which would otherwise consume this batch.
    // One batch can interleave everything — that's the point of the shared
    // vocabulary: polling carries the same frames, just a batch at a time.
    batches = [
      [
        { type: "tool_call", data: { id: "c1", name: "search", status: "running" } },
        { type: "genui", streamId: "s1", chunk: { type: "text", content: "hi", id: 1 }, done: true },
        { type: "typing", isTyping: true },
        { type: "text", id: "m1", data: { text: "Pick" }, actions: [{ label: "A" }] },
        { id: "m2", type: "text", data: { text: "plain" } },
      ],
    ];
    await poll();

    expect(toolCalls).toEqual([{ id: "c1", name: "search", status: "running" }]);
    expect(genui).toEqual([{ streamId: "s1", chunk: { type: "text", content: "hi", id: 1 }, done: true }]);
    expect(typing).toEqual([true]);
    expect(messages.map((m) => m.type)).toEqual(["quick-reply", "text"]);
    expect(messages[0]).toMatchObject({ id: "m1", data: { keepActions: true } });
    expect(messages[1]).toMatchObject({ id: "m2", data: { text: "plain" } });
    await connector.disconnect(); // stop the poll timer before the test ends
  });

  it("POSTs a GenUI component event as a genui_event frame", async () => {
    const { connector } = await connected();
    connector.receiveComponentEvent("s1", "submit", { a: 1 });
    await vi.advanceTimersByTimeAsync(1);

    const post = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === "POST",
    )!;
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({
      type: "genui_event",
      streamId: "s1",
      eventType: "submit",
      payload: { a: 1 },
    });
    await connector.disconnect();
  });
});
