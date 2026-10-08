import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IncomingMessage } from "@chativa/core";

/** Captures the hub handlers the connector registers, and what it invokes. */
class MockHubConnection {
  static current: MockHubConnection | null = null;
  handlers = new Map<string, (data: unknown) => void>();
  invocations: Array<{ method: string; args: unknown[] }> = [];
  closeHandler: ((e?: Error) => void) | null = null;
  started = false;
  stopCalls = 0;
  invokeError: Error | null = null;

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
    if (MockHubConnectionBuilder.nextStartError) throw MockHubConnectionBuilder.nextStartError;
    this.started = true;
  }

  async stop(): Promise<void> {
    this.stopCalls++;
    this.started = false;
  }

  async invoke(method: string, ...args: unknown[]): Promise<void> {
    this.invocations.push({ method, args });
    if (this.invokeError) throw this.invokeError;
  }

  receive(data: unknown, method = "ReceiveMessage"): void {
    this.handlers.get(method)?.(data);
  }
}

class MockHubConnectionBuilder {
  static nextStartError: Error | null = null;
  static lastUrl: string | null = null;
  static lastOptions: { accessTokenFactory: () => string | Promise<string> } | null = null;
  static reconnectEnabled = false;

  withUrl(url: string, options: { accessTokenFactory: () => string | Promise<string> }): this {
    MockHubConnectionBuilder.lastUrl = url;
    MockHubConnectionBuilder.lastOptions = options;
    return this;
  }
  withAutomaticReconnect(): this {
    MockHubConnectionBuilder.reconnectEnabled = true;
    return this;
  }
  build(): MockHubConnection {
    return new MockHubConnection();
  }
}

vi.mock("@microsoft/signalr", () => ({
  HubConnectionBuilder: MockHubConnectionBuilder,
}));

const { SignalRConnector } = await import("../SignalRConnector");

const hub = () => MockHubConnection.current!;

describe("SignalRConnector lifecycle", () => {
  beforeEach(() => {
    MockHubConnection.current = null;
    MockHubConnectionBuilder.nextStartError = null;
    MockHubConnectionBuilder.lastUrl = null;
    MockHubConnectionBuilder.lastOptions = null;
    MockHubConnectionBuilder.reconnectEnabled = false;
  });

  it("exposes its name and adds sent messages to history", () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    expect(connector.name).toBe("signalr");
    expect(connector.addSentToHistory).toBe(true);
  });

  it("builds the hub with the url, automatic reconnect and an empty default token", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    await connector.connect();

    expect(MockHubConnectionBuilder.lastUrl).toBe("https://hub.test/chat");
    expect(MockHubConnectionBuilder.reconnectEnabled).toBe(true);
    expect(MockHubConnectionBuilder.lastOptions!.accessTokenFactory()).toBe("");
    expect(hub().started).toBe(true);
  });

  it("passes a custom accessTokenFactory to the hub", async () => {
    const accessTokenFactory = vi.fn(async () => "tok-123");
    const connector = new SignalRConnector({ url: "https://hub.test/chat", accessTokenFactory });
    await connector.connect();

    expect(MockHubConnectionBuilder.lastOptions!.accessTokenFactory).toBe(accessTokenFactory);
    await expect(MockHubConnectionBuilder.lastOptions!.accessTokenFactory()).resolves.toBe("tok-123");
  });

  it("fires onConnect only after the hub has started", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    let startedWhenNotified: boolean | null = null;
    connector.onConnect(() => {
      startedWhenNotified = hub().started;
    });
    await connector.connect();

    expect(startedWhenNotified).toBe(true);
  });

  it("propagates a hub start failure and does not fire onConnect", async () => {
    MockHubConnectionBuilder.nextStartError = new Error("negotiate failed");
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    const onConnect = vi.fn();
    connector.onConnect(onConnect);

    await expect(connector.connect()).rejects.toThrow("negotiate failed");
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("reports the close error message through onDisconnect", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    const onDisconnect = vi.fn();
    connector.onDisconnect(onDisconnect);
    await connector.connect();

    hub().closeHandler?.(new Error("connection lost"));
    expect(onDisconnect).toHaveBeenCalledWith("connection lost");
  });

  it("reports an undefined reason for a clean close", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    const onDisconnect = vi.fn();
    connector.onDisconnect(onDisconnect);
    await connector.connect();

    hub().closeHandler?.();
    expect(onDisconnect).toHaveBeenCalledWith(undefined);
  });

  it("tolerates close and inbound pushes with no handlers registered", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    await connector.connect();

    expect(() => {
      hub().closeHandler?.(new Error("x"));
      hub().receive("plain");
      hub().receive({ id: "m", type: "text", data: { text: "x" } });
      hub().receive({ type: "typing", isTyping: true });
      hub().receive({ type: "tool_call", data: { id: "c", name: "n", status: "running" } });
      hub().receive({ type: "genui", streamId: "s", chunk: { type: "text", content: "x" }, done: true });
      hub().receive({ type: "text", from: "bot", data: { text: "?" }, actions: [{ label: "A" }] });
    }).not.toThrow();
  });

  it("stops the hub on disconnect and is then not connected", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    await connector.connect();
    const h = hub();

    await connector.disconnect();
    expect(h.stopCalls).toBe(1);
    expect(h.started).toBe(false);
    await expect(connector.sendMessage({ id: "1", type: "text", data: { text: "x" } })).rejects.toThrow(
      "SignalRConnector: not connected.",
    );
  });

  it("disconnect before connect is a no-op", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    await expect(connector.disconnect()).resolves.toBeUndefined();
  });
});

describe("SignalRConnector sending", () => {
  beforeEach(() => {
    MockHubConnection.current = null;
    MockHubConnectionBuilder.nextStartError = null;
  });

  it("invokes SendMessage with the outgoing message", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    await connector.connect();
    const msg = { id: "u1", type: "text", data: { text: "hello" } };
    await connector.sendMessage(msg);

    expect(hub().invocations).toEqual([{ method: "SendMessage", args: [msg] }]);
  });

  it("honours a custom sendMethod", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat", sendMethod: "Post" });
    await connector.connect();
    await connector.sendMessage({ id: "u1", type: "text", data: { text: "x" } });

    expect(hub().invocations[0].method).toBe("Post");
  });

  it("propagates a failed send", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    await connector.connect();
    hub().invokeError = new Error("hub down");

    await expect(connector.sendMessage({ id: "u1", type: "text", data: { text: "x" } })).rejects.toThrow(
      "hub down",
    );
  });

  it("throws when sending before connect", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    await expect(connector.sendMessage({ id: "1", type: "text", data: { text: "x" } })).rejects.toThrow(
      "SignalRConnector: not connected.",
    );
  });

  it("invokes SendSurvey with the survey payload", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    await connector.connect();
    await connector.sendSurvey({ rating: 5, comment: "great", kind: 2 });

    expect(hub().invocations).toEqual([
      { method: "SendSurvey", args: [{ rating: 5, comment: "great", kind: 2 }] },
    ]);
  });

  it("honours a custom surveyMethod", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat", surveyMethod: "Rate" });
    await connector.connect();
    await connector.sendSurvey({ rating: 1 });

    expect(hub().invocations[0].method).toBe("Rate");
  });

  it("throws when sending a survey before connect", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    await expect(connector.sendSurvey({ rating: 1 })).rejects.toThrow("SignalRConnector: not connected.");
  });

  it("swallows a failed GenUI event invoke", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    await connector.connect();
    hub().invokeError = new Error("hub down");

    expect(() => connector.receiveComponentEvent("s1", "x", {})).not.toThrow();
    // Let the rejected invoke settle; an unhandled rejection would fail the run.
    await Promise.resolve();
    await Promise.resolve();
    expect(hub().invocations).toHaveLength(1);
  });

  it("drops a GenUI event before connect", () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    expect(() => connector.receiveComponentEvent("s1", "x", {})).not.toThrow();
  });

  it("forwards GenUI event routing options in the genui_event frame", async () => {
    const connector = new SignalRConnector({ url: "https://hub.test/chat" });
    await connector.connect();
    connector.receiveComponentEvent("s1", "click", { a: 1 }, { scope: "component", component: "btn" });

    expect(hub().invocations[0].args[0]).toEqual({
      type: "genui_event",
      streamId: "s1",
      eventType: "click",
      payload: { a: 1 },
      scope: "component",
      component: "btn",
    });
  });
});

describe("SignalRConnector inbound mapping", () => {
  beforeEach(() => {
    MockHubConnection.current = null;
    MockHubConnectionBuilder.nextStartError = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function open(options: Record<string, unknown> = {}) {
    const connector = new SignalRConnector({ url: "https://hub.test/chat", ...options });
    const messages: IncomingMessage[] = [];
    connector.onMessage((m) => messages.push(m));
    await connector.connect();
    return { connector, messages };
  }

  it("listens on a custom receiveMethod", async () => {
    const { messages } = await open({ receiveMethod: "OnBotMessage" });
    hub().receive({ id: "m", type: "text", data: { text: "x" } }, "ReceiveMessage");
    hub().receive({ id: "m", type: "text", data: { text: "y" } }, "OnBotMessage");

    expect(messages).toEqual([{ id: "m", type: "text", data: { text: "y" } }]);
  });

  it("stamps a primitive push with an sr- id and the current time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(42_000);
    const { messages } = await open();
    hub().receive(7);

    expect(messages).toEqual([{ id: "sr-42000", type: "text", data: { text: "7" }, timestamp: 42_000 }]);
  });

  it("wraps a null push as a text message instead of routing it", async () => {
    const { messages } = await open();
    hub().receive(null);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: "text", data: { text: "null" } });
  });

  it("swallows genui_components frames instead of rendering a bubble", async () => {
    const { messages } = await open();
    hub().receive({ type: "genui_components", components: [{ name: "x", template: "<b></b>" }] });

    expect(messages).toHaveLength(0);
  });
});
