import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { effectScope, ref, nextTick } from "vue";
import {
  ConnectorRegistry,
  EventBus,
  chatStore,
  messageStore,
  type StoredMessage,
} from "@chativa/core";
import { useChat } from "../composables/useChat";
import { useMessages } from "../composables/useMessages";
import { useGenUIStream } from "../composables/useGenUIStream";
import { useChativaEvent } from "../composables/useChativaEvent";
import { makeFakeConnector } from "./helpers";

function textMessage(id: string, text: string): StoredMessage {
  return { id, type: "text", from: "bot", data: { text }, timestamp: Date.now() };
}

function genuiMessage(id: string, streamingComplete: boolean, chunkCount = 1): StoredMessage {
  const chunks = Array.from({ length: chunkCount }, (_, i) => ({
    type: "ui" as const,
    component: "card",
    props: { title: `c${i}` },
    id: i + 1,
  }));
  return {
    id,
    type: "genui",
    from: "bot",
    data: { chunks, streamingComplete } as unknown as Record<string, unknown>,
    timestamp: Date.now(),
  };
}

beforeEach(() => {
  messageStore.getState().clear();
});

afterEach(() => {
  messageStore.getState().clear();
  chatStore.getState().close();
});

describe("useChat", () => {
  it("mirrors chatStore state reactively and exposes its actions", () => {
    const scope = effectScope();
    const chat = scope.run(() => useChat())!;

    chat.close();
    expect(chat.isOpened.value).toBe(false);
    chat.open();
    expect(chat.isOpened.value).toBe(true);
    expect(chat.state.value.isOpened).toBe(true);
    chat.toggle();
    expect(chat.isOpened.value).toBe(false);

    chat.setFullscreen(true);
    expect(chat.isFullscreen.value).toBe(true);
    chat.setFullscreen(false);

    chat.setTheme({ colors: { primary: "#111111" } });
    expect(chat.theme.value.colors.primary).toBe("#111111");

    chatStore.getState().setConnectorStatus("connected");
    expect(chat.connectorStatus.value).toBe("connected");

    chatStore.getState().setTyping(true);
    expect(chat.isTyping.value).toBe(true);
    chatStore.getState().setTyping(false);

    chatStore.getState().setTypingMessage("Thinking…");
    expect(chat.typingMessage.value).toBe("Thinking…");
    chatStore.getState().setTypingMessage(null);

    chatStore.getState().incrementUnread();
    expect(chat.unreadCount.value).toBeGreaterThan(0);
    chat.resetUnread();
    expect(chat.unreadCount.value).toBe(0);

    chatStore.getState().setReconnectAttempt(2);
    expect(chat.reconnectAttempt.value).toBe(2);
    chatStore.getState().setReconnectAttempt(0);

    chat.setSearchQuery("hello");
    expect(chat.searchQuery.value).toBe("hello");
    chat.clearSearch();
    expect(chat.searchQuery.value).toBe("");

    expect(chat.activeToolCalls.value).toEqual([]);

    scope.stop();
  });

  it("setConnector accepts a name or an IConnector instance", () => {
    const scope = effectScope();
    const chat = scope.run(() => useChat())!;

    chat.setConnector(makeFakeConnector("vue-usechat-connector"));
    expect(ConnectorRegistry.has("vue-usechat-connector")).toBe(true);
    expect(chat.activeConnector.value).toBe("vue-usechat-connector");

    chat.setConnector("dummy");
    expect(chat.activeConnector.value).toBe("dummy");

    ConnectorRegistry.unregister("vue-usechat-connector");
    scope.stop();
  });

  it("stops updating once its effect scope is disposed", () => {
    const scope = effectScope();
    const chat = scope.run(() => useChat())!;
    chat.close();
    scope.stop();

    chatStore.getState().open();
    expect(chat.isOpened.value).toBe(false);
  });
});

describe("useMessages", () => {
  it("tracks the message list, version and last message", () => {
    const scope = effectScope();
    const { messages, version, lastMessage, removeById, updateById, clear } = scope.run(() =>
      useMessages(),
    )!;

    expect(messages.value).toEqual([]);
    expect(lastMessage.value).toBeUndefined();
    const before = version.value;

    messageStore.getState().addMessage(textMessage("vue-msg-1", "one"));
    messageStore.getState().addMessage(textMessage("vue-msg-2", "two"));
    expect(messages.value.map((m) => m.id)).toEqual(["vue-msg-1", "vue-msg-2"]);
    expect(lastMessage.value?.id).toBe("vue-msg-2");
    expect(version.value).toBeGreaterThan(before);

    updateById("vue-msg-1", { data: { text: "uno" } });
    expect(messages.value[0]?.data.text).toBe("uno");

    removeById("vue-msg-2");
    expect(messages.value.map((m) => m.id)).toEqual(["vue-msg-1"]);

    clear();
    expect(messages.value).toEqual([]);

    scope.stop();
  });

  it("keeps message object identity (no deep proxy)", () => {
    const scope = effectScope();
    const { messages } = scope.run(() => useMessages())!;
    const msg = textMessage("vue-msg-3", "same");
    messageStore.getState().addMessage(msg);
    expect(messages.value[0]).toBe(msg);
    scope.stop();
  });
});

describe("useGenUIStream", () => {
  it("exposes GenUI messages as typed streams and focuses the newest by default", () => {
    const scope = effectScope();
    const { streams, stream, chunks, isStreaming } = scope.run(() => useGenUIStream())!;

    expect(streams.value).toEqual([]);
    expect(stream.value).toBeUndefined();
    expect(chunks.value).toEqual([]);
    expect(isStreaming.value).toBe(false);

    messageStore.getState().addMessage(textMessage("vue-text-1", "not genui"));
    messageStore.getState().addMessage(genuiMessage("vue-genui-a", true, 1));
    messageStore.getState().addMessage(genuiMessage("vue-genui-b", false, 2));

    expect(streams.value.map((s) => s.messageId)).toEqual(["vue-genui-a", "vue-genui-b"]);
    expect(stream.value?.messageId).toBe("vue-genui-b");
    expect(chunks.value).toHaveLength(2);
    expect(stream.value?.streamingComplete).toBe(false);
    expect(isStreaming.value).toBe(true);

    messageStore.getState().updateById("vue-genui-b", {
      data: { chunks: [], streamingComplete: true },
    });
    expect(isStreaming.value).toBe(false);

    scope.stop();
  });

  it("focuses a specific message via a ref argument", async () => {
    const scope = effectScope();
    const id = ref<string | undefined>("vue-genui-c");
    const { stream } = scope.run(() => useGenUIStream(id))!;

    messageStore.getState().addMessage(genuiMessage("vue-genui-c", true, 3));
    messageStore.getState().addMessage(genuiMessage("vue-genui-d", true, 1));
    expect(stream.value?.messageId).toBe("vue-genui-c");
    expect(stream.value?.chunks).toHaveLength(3);

    id.value = "missing";
    await nextTick();
    expect(stream.value).toBeUndefined();

    scope.stop();
  });

  it("treats a GenUI message without stream data as an empty, incomplete stream", () => {
    const scope = effectScope();
    const { stream } = scope.run(() => useGenUIStream())!;
    messageStore.getState().addMessage({
      id: "vue-genui-empty",
      type: "genui",
      from: "bot",
      data: {},
      timestamp: 1,
    });
    expect(stream.value?.chunks).toEqual([]);
    expect(stream.value?.streamingComplete).toBe(false);
    scope.stop();
  });

  it("tracks in-flight connector streams via the EventBus", () => {
    const scope = effectScope();
    const { activeStreamIds, isStreaming } = scope.run(() => useGenUIStream())!;

    EventBus.emit("genui_stream_started", { streamId: "s1" });
    EventBus.emit("genui_stream_started", { streamId: "s1" });
    EventBus.emit("genui_stream_started", { streamId: "s2" });
    expect(activeStreamIds.value).toEqual(["s1", "s2"]);
    expect(isStreaming.value).toBe(true);

    EventBus.emit("genui_stream_completed", { streamId: "s1" });
    EventBus.emit("genui_stream_completed", { streamId: "s2" });
    expect(activeStreamIds.value).toEqual([]);
    expect(isStreaming.value).toBe(false);

    scope.stop();
    EventBus.emit("genui_stream_started", { streamId: "s3" });
    expect(activeStreamIds.value).toEqual([]);
  });
});

describe("useChativaEvent", () => {
  it("subscribes for the scope's lifetime and returns an early-stop function", () => {
    const seen: string[] = [];
    const scope = effectScope();
    const stop = scope.run(() =>
      useChativaEvent("search_query_changed", ({ query }) => seen.push(query)),
    )!;

    EventBus.emit("search_query_changed", { query: "a" });
    stop();
    EventBus.emit("search_query_changed", { query: "b" });
    expect(seen).toEqual(["a"]);
    scope.stop();
  });

  it("works outside an effect scope when stopped manually", () => {
    const seen: string[] = [];
    const stop = useChativaEvent("search_query_changed", ({ query }) => seen.push(query));
    EventBus.emit("search_query_changed", { query: "x" });
    stop();
    EventBus.emit("search_query_changed", { query: "y" });
    expect(seen).toEqual(["x"]);
  });
});
