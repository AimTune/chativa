import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SseConnector } from "../SseConnector";
import type { ToolCall, AIChunk, IncomingMessage } from "@chativa/core";

/** Minimal EventSource stub — tests push `data:` events by hand. */
class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: MockEventSource[] = [];

  readyState = MockEventSource.CONNECTING;
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  listeners = new Map<string, (ev: { data: string }) => void>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (ev: { data: string }) => void): void {
    this.listeners.set(type, handler);
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  open(): void {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.();
  }
}

async function connected() {
  const connector = new SseConnector({ url: "http://test/stream", sendUrl: "http://test/send" });
  const messages: IncomingMessage[] = [];
  const toolCalls: ToolCall[] = [];
  const genui: Array<{ streamId: string; chunk: AIChunk; done: boolean }> = [];
  const typing: boolean[] = [];
  connector.onMessage((m) => messages.push(m));
  connector.onToolCall((tc) => toolCalls.push(tc));
  connector.onGenUIChunk((streamId, chunk, done) => genui.push({ streamId, chunk, done }));
  connector.onTyping((t) => typing.push(t));

  const p = connector.connect();
  const es = MockEventSource.instances[0];
  es.open();
  await p;

  const receive = (frame: unknown) => es.onmessage?.({ data: JSON.stringify(frame) });
  return { connector, es, receive, messages, toolCalls, genui, typing };
}

describe("SseConnector frame routing", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes a tool_call data event to onToolCall", async () => {
    const { receive, toolCalls, messages } = await connected();
    receive({ type: "tool_call", data: { id: "c1", name: "lookup", status: "running" } });

    expect(toolCalls).toEqual([{ id: "c1", name: "lookup", status: "running" }]);
    expect(messages).toHaveLength(0);
  });

  it("routes a genui data event to onGenUIChunk", async () => {
    const { receive, genui } = await connected();
    receive({ type: "genui", streamId: "s1", chunk: { type: "text", content: "hi", id: 1 }, done: false });

    expect(genui).toEqual([{ streamId: "s1", chunk: { type: "text", content: "hi", id: 1 }, done: false }]);
  });

  it("still routes the typing frame it always supported", async () => {
    const { receive, typing } = await connected();
    receive({ type: "typing", isTyping: true });

    expect(typing).toEqual([true]);
  });

  it("surfaces a bot text frame with actions as a quick-reply (HITL chips)", async () => {
    const { receive, messages } = await connected();
    receive({ type: "text", id: "m1", data: { text: "Pick one" }, actions: [{ label: "A" }] });

    expect(messages[0]).toMatchObject({
      id: "m1",
      type: "quick-reply",
      data: { text: "Pick one", keepActions: true },
    });
  });

  it("still delivers a plain message and the connected notice", async () => {
    const { receive, messages } = await connected();
    receive({ type: "connected" });
    receive({ id: "m2", type: "text", data: { text: "hello" } });

    expect(messages).toEqual([{ id: "m2", type: "text", data: { text: "hello" } }]);
  });

  it("POSTs a GenUI component event as a genui_event frame", async () => {
    const { connector } = await connected();
    connector.receiveComponentEvent("s1", "form_submit", { ok: true });

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    expect(call[0]).toBe("http://test/send");
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({
      type: "genui_event",
      streamId: "s1",
      eventType: "form_submit",
      payload: { ok: true },
    });
  });
});
