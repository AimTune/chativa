import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChatEngine } from "../ChatEngine";
import { MultiConversationEngine } from "../MultiConversationEngine";
import { MessageTypeRegistry } from "../registries/MessageTypeRegistry";
import { ExtensionRegistry } from "../registries/ExtensionRegistry";
import { genUIDefinitionStore } from "../GenUIDefinitionStore";
import messageStore from "../stores/MessageStore";
import chatStore from "../stores/ChatStore";
import conversationStore from "../stores/ConversationStore";
import { EventBus } from "../EventBus";
import type {
  IConnector,
  MessageHandler,
  DisconnectHandler,
  ProgressHandler,
  ConversationHandler,
} from "../../domain/ports/IConnector";
import type { AIChunk, GenUIChunkHandler, GenUIComponentsHandler } from "../../domain/entities/GenUI";
import type { ToolCall, ToolCallHandler } from "../../domain/entities/ToolCall";
import type { Conversation } from "../../domain/entities/Conversation";
import { DEFAULT_THEME } from "../../domain/value-objects/Theme";

/**
 * Edge-case coverage for ChatEngine callbacks that the main ChatEngine suite
 * does not exercise: progress updates, server-defined GenUI components,
 * reconnect bookkeeping and tool-call trace merging.
 */
function createConnector() {
  const h: {
    message?: MessageHandler;
    disconnect?: DisconnectHandler;
    progress?: ProgressHandler;
    components?: GenUIComponentsHandler;
    genui?: GenUIChunkHandler;
    toolCall?: ToolCallHandler;
    conversation?: ConversationHandler;
  } = {};
  const connector: IConnector = {
    name: "edge",
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: (cb) => { h.message = cb; },
    onDisconnect: (cb) => { h.disconnect = cb; },
    onProgress: (cb) => { h.progress = cb; },
    onGenUIComponents: (cb) => { h.components = cb; },
    onGenUIChunk: (cb) => { h.genui = cb; },
    onToolCall: (cb) => { h.toolCall = cb; },
    onConversationUpdate: (cb) => { h.conversation = cb; },
  };
  return { connector, h };
}

const FallbackComponent = class extends HTMLElement {} as typeof HTMLElement;

beforeEach(() => {
  messageStore.getState().clear();
  MessageTypeRegistry.clear();
  ExtensionRegistry.clear();
  MessageTypeRegistry.setFallback(FallbackComponent);
  EventBus.clear();
  genUIDefinitionStore.clear();
  conversationStore.getState().setConversations([]);
  conversationStore.getState().setActive(null);
  chatStore.setState({
    isOpened: true,
    connectorStatus: "idle",
    isTyping: false,
    typingMessage: null,
    unreadCount: 0,
    reconnectAttempt: 0,
    theme: DEFAULT_THEME,
    activeToolCalls: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ChatEngine — progress updates", () => {
  it("shows the progress message as the typing message and clears it on null", async () => {
    const { connector, h } = createConnector();
    await new ChatEngine(connector).init();

    h.progress?.({ stage: "search", message: "Searching the docs…" });
    expect(chatStore.getState().typingMessage).toBe("Searching the docs…");
    expect(chatStore.getState().isTyping).toBe(true);

    h.progress?.(null);
    expect(chatStore.getState().typingMessage).toBeNull();
  });

  it("treats a progress update without a message as clearing the label", async () => {
    const { connector, h } = createConnector();
    await new ChatEngine(connector).init();
    h.progress?.({ message: "Working" });
    h.progress?.({ stage: "only-stage" });
    expect(chatStore.getState().typingMessage).toBeNull();
  });
});

describe("ChatEngine — server-defined GenUI components", () => {
  it("publishes new definitions and emits genui_components_registered once", async () => {
    const { connector, h } = createConnector();
    await new ChatEngine(connector).init();
    const registered = vi.fn();
    EventBus.on("genui_components_registered", registered);

    const defs = [{ name: "order-card", template: "<p>{{id}}</p>" }];
    h.components?.(defs);
    expect(registered).toHaveBeenCalledWith({ definitions: defs });
    expect(genUIDefinitionStore.has("order-card")).toBe(true);

    // A reconnect re-announcing the same catalog notifies nobody.
    h.components?.(defs);
    expect(registered).toHaveBeenCalledTimes(1);
  });
});

describe("ChatEngine — reconnect", () => {
  it("restores 'connected' and resets the attempt counter after a successful reconnect", async () => {
    vi.useFakeTimers();
    const { connector, h } = createConnector();
    await new ChatEngine(connector).init();

    h.disconnect?.("network");
    expect(chatStore.getState().connectorStatus).toBe("connecting");
    expect(chatStore.getState().reconnectAttempt).toBe(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(connector.connect).toHaveBeenCalledTimes(2);
    expect(chatStore.getState().connectorStatus).toBe("connected");
    expect(chatStore.getState().reconnectAttempt).toBe(0);
  });

  it("does nothing when the timer fires after the engine was marked destroyed", async () => {
    vi.useFakeTimers();
    const { connector, h } = createConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    h.disconnect?.("network");
    // Simulate the race where the timer is already queued when teardown starts.
    (engine as unknown as { _destroyed: boolean })._destroyed = true;
    await vi.advanceTimersByTimeAsync(2000);
    expect(connector.connect).toHaveBeenCalledTimes(1);
  });
});

describe("ChatEngine — GenUI stream lifecycle", () => {
  it("ignores a non-final stream_done event without creating a message", async () => {
    const { connector, h } = createConnector();
    await new ChatEngine(connector).init();
    const completed = vi.fn();
    EventBus.on("genui_stream_completed", completed);

    const doneEvent = { type: "event", name: "stream_done", payload: {}, id: 9 } as unknown as AIChunk;
    h.genui?.("s1", doneEvent, false);
    expect(messageStore.getState().messages).toHaveLength(0);
    expect(completed).not.toHaveBeenCalled();
  });

  it("merges tool calls that started mid-stream into the trace already attached to the host", async () => {
    const { connector, h } = createConnector();
    await new ChatEngine(connector).init();

    const early: ToolCall = { id: "t-early", name: "lookup", status: "completed" };
    h.toolCall?.(early);
    h.genui?.("s-merge", { type: "text", content: "Working", id: 1 }, false);
    // Attached to the host; buffer cleared.
    expect(chatStore.getState().activeToolCalls).toEqual([]);

    h.toolCall?.({ id: "t-late", name: "render", status: "running" });
    h.genui?.("s-merge", { type: "text", content: " done", id: 1 }, true);

    const trace = messageStore.getState().messages[0].data.toolCalls as ToolCall[];
    expect(trace.map((tc) => tc.id)).toEqual(["t-early", "t-late"]);
    expect(chatStore.getState().activeToolCalls).toEqual([]);
  });
});

describe("MultiConversationEngine — conversation updates", () => {
  it("applies connector-pushed conversation updates to the store", async () => {
    const { connector, h } = createConnector();
    const conv: Conversation = { id: "c1", title: "Support", status: "open" };
    connector.listConversations = vi.fn().mockResolvedValue([conv]);
    const engine = new MultiConversationEngine(connector);
    await engine.init();

    h.conversation?.({ ...conv, title: "Renamed", status: "closed" });
    const stored = conversationStore.getState().conversations.find((c) => c.id === "c1");
    expect(stored).toMatchObject({ title: "Renamed", status: "closed" });
  });

  it("auto-activates the first conversation when none is open or pending", async () => {
    const { connector } = createConnector();
    connector.listConversations = vi.fn().mockResolvedValue([
      { id: "old", title: "Old", status: "closed" },
      { id: "older", title: "Older", status: "closed" },
    ]);
    await new MultiConversationEngine(connector).init();
    expect(conversationStore.getState().activeConversationId).toBe("old");
  });

  it("does not activate anything when the connector lists no conversations", async () => {
    const { connector } = createConnector();
    connector.listConversations = vi.fn().mockResolvedValue([]);
    await new MultiConversationEngine(connector).init();
    expect(conversationStore.getState().activeConversationId).toBeNull();
  });
});

describe("ChatStore.setTypingMessage", () => {
  it("turns typing on with a label, and clearing the label keeps typing state", () => {
    chatStore.getState().setTypingMessage("Thinking…");
    expect(chatStore.getState()).toMatchObject({ typingMessage: "Thinking…", isTyping: true });

    chatStore.getState().setTypingMessage(null);
    expect(chatStore.getState()).toMatchObject({ typingMessage: null, isTyping: true });

    chatStore.getState().setTyping(false);
    expect(chatStore.getState()).toMatchObject({ typingMessage: null, isTyping: false });
  });
});
