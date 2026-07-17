import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolCall, AIChunk, IncomingMessage } from "@chativa/core";

/** Captures the hub handlers the connector registers, and what it invokes. */
class MockHubConnection {
  static current: MockHubConnection | null = null;
  handlers = new Map<string, (data: unknown) => void>();
  invocations: Array<{ method: string; args: unknown[] }> = [];
  closeHandler: ((e?: Error) => void) | null = null;
  started = false;

  constructor() {
    MockHubConnection.current = this;
  }

  on(method: string, handler: (data: unknown) => void): void {
    this.handlers.set(method, handler);
  }

  onclose(handler: (e?: Error) => void): void {
    this.closeHandler = handler;
  }

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.started = false;
  }

  async invoke(method: string, ...args: unknown[]): Promise<void> {
    this.invocations.push({ method, args });
  }

  /** Simulate the hub pushing a payload through the receive method. */
  receive(data: unknown, method = "ReceiveMessage"): void {
    this.handlers.get(method)?.(data);
  }
}

class MockHubConnectionBuilder {
  withUrl(): this {
    return this;
  }
  withAutomaticReconnect(): this {
    return this;
  }
  build(): MockHubConnection {
    return new MockHubConnection();
  }
}

// The connector dynamically imports @microsoft/signalr, which isn't installed
// here — stub the module so the adapter can be exercised without the hub.
vi.mock("@microsoft/signalr", () => ({
  HubConnectionBuilder: MockHubConnectionBuilder,
}));

const { SignalRConnector } = await import("../SignalRConnector");

async function connected(options: Record<string, unknown> = {}) {
  const connector = new SignalRConnector({ url: "https://hub.test/chat", ...options });
  const messages: IncomingMessage[] = [];
  const toolCalls: ToolCall[] = [];
  const genui: Array<{ streamId: string; chunk: AIChunk; done: boolean }> = [];
  const typing: boolean[] = [];
  connector.onMessage((m) => messages.push(m));
  connector.onToolCall((tc) => toolCalls.push(tc));
  connector.onGenUIChunk((streamId, chunk, done) => genui.push({ streamId, chunk, done }));
  connector.onTyping((t) => typing.push(t));

  await connector.connect();
  const hub = MockHubConnection.current!;
  return { connector, hub, messages, toolCalls, genui, typing };
}

describe("SignalRConnector frame routing", () => {
  beforeEach(() => {
    MockHubConnection.current = null;
  });

  it("routes a tool_call pushed through the receive method to onToolCall", async () => {
    const { hub, toolCalls, messages } = await connected();
    hub.receive({ type: "tool_call", data: { id: "c1", name: "search", status: "completed", result: "ok" } });

    expect(toolCalls).toEqual([{ id: "c1", name: "search", status: "completed", result: "ok" }]);
    expect(messages).toHaveLength(0);
  });

  it("routes a genui frame pushed through the receive method to onGenUIChunk", async () => {
    const { hub, genui, messages } = await connected();
    hub.receive({
      type: "genui",
      streamId: "s1",
      chunk: { type: "ui", component: "weather", props: { city: "Ankara" }, id: 1 },
      done: false,
    });

    expect(genui).toEqual([
      { streamId: "s1", chunk: { type: "ui", component: "weather", props: { city: "Ankara" }, id: 1 }, done: false },
    ]);
    expect(messages).toHaveLength(0);
  });

  it("routes a typing frame to onTyping", async () => {
    const { hub, typing } = await connected();
    hub.receive({ type: "typing", isTyping: true });

    expect(typing).toEqual([true]);
  });

  it("surfaces a bot text frame with actions as a quick-reply (HITL chips)", async () => {
    const { hub, messages } = await connected();
    hub.receive({
      type: "text",
      id: "m1",
      from: "bot",
      data: { text: "Approve deploy?" },
      actions: [{ label: "Approve" }, { label: "Reject" }],
      timestamp: 99,
    });

    expect(messages).toEqual([
      {
        id: "m1",
        type: "quick-reply",
        data: {
          text: "Approve deploy?",
          actions: [{ label: "Approve" }, { label: "Reject" }],
          keepActions: true,
        },
        timestamp: 99,
      },
    ]);
  });

  it("still delivers a plain message object untouched", async () => {
    const { hub, messages } = await connected();
    hub.receive({ id: "m2", type: "text", data: { text: "hi" } });

    expect(messages).toEqual([{ id: "m2", type: "text", data: { text: "hi" } }]);
  });

  it("wraps a bare string push as a text message", async () => {
    const { hub, messages } = await connected();
    hub.receive("hello there");

    expect(messages[0]).toMatchObject({ type: "text", data: { text: "hello there" } });
  });

  it("invokes SendGenUIEvent with the genui_event frame", async () => {
    const { connector, hub } = await connected();
    connector.receiveComponentEvent("s1", "form_submit", { email: "a@b.com" });

    expect(hub.invocations).toEqual([
      {
        method: "SendGenUIEvent",
        args: [{ type: "genui_event", streamId: "s1", eventType: "form_submit", payload: { email: "a@b.com" } }],
      },
    ]);
  });

  it("honours a custom genUIEventMethod", async () => {
    const { connector, hub } = await connected({ genUIEventMethod: "OnComponentEvent" });
    connector.receiveComponentEvent("s1", "x", null);

    expect(hub.invocations[0].method).toBe("OnComponentEvent");
  });
});
