import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChatEngine } from "../ChatEngine";
import { MessageTypeRegistry } from "../registries/MessageTypeRegistry";
import { ExtensionRegistry } from "../registries/ExtensionRegistry";
import messageStore from "../stores/MessageStore";
import chatStore from "../stores/ChatStore";
import { EventBus } from "../EventBus";
import type {
  IConnector,
  MessageHandler,
  DisconnectHandler,
  TypingHandler,
  MessageStatusHandler,
} from "../../domain/ports/IConnector";
import type { AIChunk, GenUIChunkHandler } from "../../domain/entities/GenUI";
import { DEFAULT_THEME } from "../../domain/value-objects/Theme";

/** Create a controllable mock connector. */
function createMockConnector(): IConnector & {
  simulateIncoming: (text: string, id?: string) => void;
  simulateDisconnect: (reason?: string) => void;
  simulateTyping: (v: boolean) => void;
  simulateMessageStatus: (msgId: string, status: "sending" | "sent" | "read") => void;
  simulateGenUIChunk: (streamId: string, chunk: AIChunk, done: boolean) => void;
} {
  let msgHandler: MessageHandler | null = null;
  let disconnectHandler: DisconnectHandler | null = null;
  let typingHandler: TypingHandler | null = null;
  let statusHandler: MessageStatusHandler | null = null;
  let genUIHandler: GenUIChunkHandler | null = null;

  return {
    name: "mock",
    addSentToHistory: true,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendFeedback: vi.fn().mockResolvedValue(undefined),
    sendFile: vi.fn().mockResolvedValue(undefined),
    receiveComponentEvent: vi.fn(),
    onMessage(cb) { msgHandler = cb; },
    onDisconnect(cb) { disconnectHandler = cb; },
    onTyping(cb) { typingHandler = cb; },
    onMessageStatus(cb) { statusHandler = cb; },
    onGenUIChunk(cb) { genUIHandler = cb; },
    simulateIncoming(text: string, id = `sim-${Date.now()}`) {
      msgHandler?.({ id, type: "text", data: { text }, timestamp: Date.now() });
    },
    simulateDisconnect(reason?: string) { disconnectHandler?.(reason); },
    simulateTyping(v: boolean) { typingHandler?.(v); },
    simulateMessageStatus(msgId: string, status: "sending" | "sent" | "read") { statusHandler?.(msgId, status); },
    simulateGenUIChunk(streamId, chunk, done) { genUIHandler?.(streamId, chunk, done); },
  };
}

const FallbackComponent = class extends HTMLElement {} as typeof HTMLElement;

describe("ChatEngine", () => {
  beforeEach(() => {
    messageStore.getState().clear();
    MessageTypeRegistry.clear();
    ExtensionRegistry.clear();
    MessageTypeRegistry.setFallback(FallbackComponent);
    EventBus.clear();
    chatStore.setState({
      isOpened: false,
      isRendered: false,
      isFullscreen: false,
      allowFullscreen: true,
      activeConnector: "dummy",
      connectorStatus: "idle",
      isTyping: false,
      unreadCount: 0,
      reconnectAttempt: 0,
      theme: DEFAULT_THEME,
      hasMoreHistory: false,
      isLoadingHistory: false,
      historyCursor: undefined,
      searchQuery: "",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── connect / init ─────────────────────────────────────────────────

  it("calls connector.connect() on init", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    expect(connector.connect).toHaveBeenCalledOnce();
  });

  it("sets status connecting then connected on successful init", async () => {
    const statuses: string[] = [];
    EventBus.on("connector_status_changed", ({ status }) => statuses.push(status));
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    expect(statuses).toEqual(["connecting", "connected"]);
  });

  it("sets status error and throws when connect() fails", async () => {
    const connector = createMockConnector();
    (connector.connect as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail"));
    const engine = new ChatEngine(connector);
    await expect(engine.init()).rejects.toThrow("fail");
    expect(chatStore.getState().connectorStatus).toBe("error");
  });

  // ── incoming messages ──────────────────────────────────────────────

  it("adds incoming messages to the message store", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateIncoming("Hello!");
    expect(messageStore.getState().messages).toHaveLength(1);
    expect(messageStore.getState().messages[0].data.text).toBe("Hello!");
  });

  it("emits message_received event on incoming message", async () => {
    const handler = vi.fn();
    EventBus.on("message_received", handler);
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateIncoming("Hey");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("increments unreadCount when chat is closed on incoming message", async () => {
    chatStore.setState({ isOpened: false });
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateIncoming("msg1");
    connector.simulateIncoming("msg2");
    expect(chatStore.getState().unreadCount).toBe(2);
  });

  it("does NOT increment unreadCount when chat is open", async () => {
    chatStore.setState({ isOpened: true });
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateIncoming("visible");
    expect(chatStore.getState().unreadCount).toBe(0);
  });

  it("drops incoming message when extension blocks it", async () => {
    ExtensionRegistry.install({
      name: "blocker",
      version: "1.0.0",
      install(ctx) { ctx.onAfterReceive(() => null); },
    });
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateIncoming("blocked");
    expect(messageStore.getState().messages).toHaveLength(0);
  });

  // ── outgoing messages ──────────────────────────────────────────────

  it("adds sent messages to store when addSentToHistory is true", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.send({ id: "1", type: "text", data: { text: "Hi" }, timestamp: 0 });
    expect(messageStore.getState().messages).toHaveLength(1);
    expect(connector.sendMessage).toHaveBeenCalledOnce();
  });

  it("sets status sending then sent", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.send({ id: "s1", type: "text", data: { text: "msg" }, timestamp: 0 });
    const msg = messageStore.getState().messages.find((m) => m.id === "s1");
    expect(msg?.status).toBe("sent");
  });

  it("emits message_sent event on send", async () => {
    const handler = vi.fn();
    EventBus.on("message_sent", handler);
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.send({ id: "e1", type: "text", data: { text: "go" }, timestamp: 0 });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does NOT add to store when addSentToHistory is false", async () => {
    const connector = { ...createMockConnector(), addSentToHistory: false };
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.send({ id: "2", type: "text", data: { text: "Hi" }, timestamp: 0 });
    expect(messageStore.getState().messages).toHaveLength(0);
    expect(connector.sendMessage).toHaveBeenCalledOnce();
  });

  it("drops outgoing message when extension blocks it", async () => {
    ExtensionRegistry.install({
      name: "send-blocker",
      version: "1.0.0",
      install(ctx) { ctx.onBeforeSend(() => null); },
    });
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.send({ id: "3", type: "text", data: { text: "Hi" }, timestamp: 0 });
    expect(messageStore.getState().messages).toHaveLength(0);
    expect(connector.sendMessage).not.toHaveBeenCalled();
  });

  // ── typing indicator ───────────────────────────────────────────────

  it("sets isTyping when connector fires onTyping", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateTyping(true);
    expect(chatStore.getState().isTyping).toBe(true);
    connector.simulateTyping(false);
    expect(chatStore.getState().isTyping).toBe(false);
  });

  it("clears isTyping when message arrives", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateTyping(true);
    connector.simulateIncoming("answer");
    expect(chatStore.getState().isTyping).toBe(false);
  });

  // ── message status ─────────────────────────────────────────────────

  it("updates message status via onMessageStatus", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.send({ id: "ms1", type: "text", data: { text: "hi" }, timestamp: 0 });
    connector.simulateMessageStatus("ms1", "read");
    const msg = messageStore.getState().messages.find((m) => m.id === "ms1");
    expect(msg?.status).toBe("read");
  });

  // ── sendFeedback ───────────────────────────────────────────────────

  it("delegates sendFeedback to connector", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.sendFeedback("msg-1", "like");
    expect(connector.sendFeedback).toHaveBeenCalledWith("msg-1", "like");
  });

  it("sendFeedback does nothing if connector has no sendFeedback", async () => {
    const connector = createMockConnector();
    (connector as IConnector).sendFeedback = undefined;
    const engine = new ChatEngine(connector);
    await engine.init();
    await expect(engine.sendFeedback("x", "dislike")).resolves.toBeUndefined();
  });

  // ── sendFile ───────────────────────────────────────────────────────

  it("calls connector.sendFile and emits file_uploaded", async () => {
    const handler = vi.fn();
    EventBus.on("file_uploaded", handler);
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    const file = new File(["data"], "test.txt", { type: "text/plain" });
    await engine.sendFile(file, { tag: "upload" });
    expect(connector.sendFile).toHaveBeenCalledWith(file, { tag: "upload" });
    expect(handler).toHaveBeenCalledWith({ name: "test.txt", size: file.size });
  });

  it("sendFile does nothing if connector has no sendFile", async () => {
    const connector = createMockConnector();
    (connector as IConnector).sendFile = undefined;
    const engine = new ChatEngine(connector);
    await engine.init();
    const file = new File(["x"], "a.txt");
    await expect(engine.sendFile(file)).resolves.toBeUndefined();
  });

  // ── loadHistory ────────────────────────────────────────────────────

  it("calls connector.loadHistory on init when supported", async () => {
    const connector = createMockConnector();
    (connector as IConnector).loadHistory = vi.fn().mockResolvedValue({
      messages: [{ id: "h1", type: "text", data: { text: "past" }, timestamp: 0 }],
      hasMore: false,
      cursor: undefined,
    });
    const engine = new ChatEngine(connector);
    await engine.init();
    expect(connector.loadHistory).toHaveBeenCalledOnce();
    expect(messageStore.getState().messages).toHaveLength(1);
  });

  it("emits history_loaded event", async () => {
    const handler = vi.fn();
    EventBus.on("history_loaded", handler);
    const connector = createMockConnector();
    (connector as IConnector).loadHistory = vi.fn().mockResolvedValue({
      messages: [{ id: "h2", type: "text", data: { text: "old" }, timestamp: 0 }],
      hasMore: true,
      cursor: "page2",
    });
    const engine = new ChatEngine(connector);
    await engine.init();
    expect(handler).toHaveBeenCalledWith({ count: 1 });
    expect(chatStore.getState().hasMoreHistory).toBe(true);
    expect(chatStore.getState().historyCursor).toBe("page2");
  });

  it("loadHistory is a no-op when connector does not support it", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.loadHistory(); // should not throw
    expect(messageStore.getState().messages).toHaveLength(0);
  });

  it("loadHistory is skipped when already loading", async () => {
    const connector = createMockConnector();
    const loadFn = vi.fn().mockResolvedValue({ messages: [], hasMore: false, cursor: undefined });
    (connector as IConnector).loadHistory = loadFn;
    const engine = new ChatEngine(connector);
    await engine.init();
    // Manually mark as loading
    chatStore.getState().setIsLoadingHistory(true);
    await engine.loadHistory();
    // loadHistory was already called once during init; should not be called again
    expect(loadFn).toHaveBeenCalledTimes(1);
  });

  // ── disconnect / reconnect ─────────────────────────────────────────

  it("calls connector.disconnect() on destroy", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.destroy();
    expect(connector.disconnect).toHaveBeenCalledOnce();
  });

  it("sets status disconnected on destroy", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.destroy();
    expect(chatStore.getState().connectorStatus).toBe("disconnected");
  });

  it("auto-reconnects on unexpected disconnect", async () => {
    vi.useFakeTimers();
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateDisconnect(); // not "user" reason → should reconnect
    expect(chatStore.getState().reconnectAttempt).toBe(1);
    await vi.advanceTimersByTimeAsync(2001);
    expect(connector.connect).toHaveBeenCalledTimes(2);
    await engine.destroy();
  });

  it("does NOT auto-reconnect on user-initiated disconnect", async () => {
    vi.useFakeTimers();
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateDisconnect("user");
    expect(chatStore.getState().reconnectAttempt).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    // connect called only once (during init)
    expect(connector.connect).toHaveBeenCalledTimes(1);
  });

  it("stops reconnecting after 3 failed attempts and sets error status", async () => {
    vi.useFakeTimers();
    const connector = createMockConnector();
    (connector.connect as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(undefined) // init succeeds
      .mockRejectedValue(new Error("down")); // all reconnects fail

    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateDisconnect();

    // Advance through 3 reconnect delays (2s, 4s, 6s)
    await vi.advanceTimersByTimeAsync(2001);
    await vi.advanceTimersByTimeAsync(4001);
    await vi.advanceTimersByTimeAsync(6001);

    expect(chatStore.getState().connectorStatus).toBe("error");
  });

  it("cancels reconnect timer on destroy", async () => {
    vi.useFakeTimers();
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateDisconnect();
    // Destroy before the timer fires
    await engine.destroy();
    await vi.advanceTimersByTimeAsync(5000);
    // connect should only have been called once (during init)
    expect(connector.connect).toHaveBeenCalledTimes(1);
  });

  it("ignores reconnect timer callback when already destroyed", async () => {
    vi.useFakeTimers();
    const connector = createMockConnector();
    // Make reconnect succeed so the timer fires but _destroyed guard hits
    (connector.connect as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(undefined); // init
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateDisconnect();
    // destroy() sets _destroyed = true and clears the timer, but if we advance
    // time first the callback is already queued; test that a second destroy
    // right after advancing doesn't double-reconnect.
    await engine.destroy();
    await vi.advanceTimersByTimeAsync(2001);
    expect(connector.connect).toHaveBeenCalledTimes(1);
  });

  // ── GenUI streaming ────────────────────────────────────────────────

  it("creates a genui message on first GenUI chunk", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateGenUIChunk("stream1", { type: "text", content: "Hello", id: 1 }, false);
    const msgs = messageStore.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe("genui");
  });

  it("emits genui_stream_started on first chunk", async () => {
    const handler = vi.fn();
    EventBus.on("genui_stream_started", handler);
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateGenUIChunk("s1", { type: "text", content: "x", id: 1 }, false);
    expect(handler).toHaveBeenCalledWith({ streamId: "s1" });
  });

  it("appends to existing genui message on subsequent chunks", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateGenUIChunk("s2", { type: "text", content: "A", id: 1 }, false);
    connector.simulateGenUIChunk("s2", { type: "text", content: "B", id: 2 }, false);
    const msgs = messageStore.getState().messages;
    expect(msgs).toHaveLength(1);
    const data = msgs[0].data as { chunks: Array<{ content: string }> };
    expect(data.chunks).toHaveLength(2);
    expect(data.chunks[1].content).toBe("B");
  });

  it("emits genui_stream_completed on done=true", async () => {
    const handler = vi.fn();
    EventBus.on("genui_stream_completed", handler);
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateGenUIChunk("s3", { type: "text", content: "final", id: 1 }, true);
    expect(handler).toHaveBeenCalledWith({ streamId: "s3" });
  });

  it("increments unread for genui message when chat is closed", async () => {
    chatStore.setState({ isOpened: false, unreadCount: 0 });
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateGenUIChunk("s4", { type: "text", content: "ui", id: 1 }, false);
    expect(chatStore.getState().unreadCount).toBe(1);
  });

  it("does NOT increment unread for genui message when chat is open", async () => {
    chatStore.setState({ isOpened: true, unreadCount: 0 });
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateGenUIChunk("s5", { type: "text", content: "ui", id: 1 }, false);
    expect(chatStore.getState().unreadCount).toBe(0);
  });

  it("event-type chunk is stored alongside text chunks", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateGenUIChunk("s-ev", { type: "text", content: "A", id: 1 }, false);
    connector.simulateGenUIChunk("s-ev", { type: "event", name: "form_submit", payload: {}, id: 2 }, false);
    const data = messageStore.getState().messages[0].data as { chunks: AIChunk[] };
    expect(data.chunks).toHaveLength(2);
    expect(data.chunks[1].type).toBe("event");
  });

  // ── receiveComponentEvent ──────────────────────────────────────────

  it("routes component events to connector by stream id", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateGenUIChunk("stream-ce", { type: "text", content: "x", id: 1 }, false);
    const msgId = messageStore.getState().messages[0].id;
    engine.receiveComponentEvent(msgId, "click", { value: 42 });
    expect(connector.receiveComponentEvent).toHaveBeenCalledWith("stream-ce", "click", { value: 42 });
  });

  it("ignores receiveComponentEvent for unknown msgId", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    engine.receiveComponentEvent("unknown-id", "click", {});
    expect(connector.receiveComponentEvent).not.toHaveBeenCalled();
  });
});
