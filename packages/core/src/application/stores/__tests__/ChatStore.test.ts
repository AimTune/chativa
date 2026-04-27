import { describe, it, expect, vi, beforeEach } from "vitest";
import chatStore from "../ChatStore";
import { EventBus } from "../../EventBus";
import { DEFAULT_THEME } from "../../../domain/value-objects/Theme";

describe("ChatStore", () => {
  beforeEach(() => {
    // Reset to initial state
    chatStore.setState({
      isOpened: false,
      isRendered: false,
      isFullscreen: false,
      allowFullscreen: true,
      activeConnector: "dummy",
      connectorStatus: "idle",
      theme: DEFAULT_THEME,
    });
  });

  it("starts closed and not rendered", () => {
    const s = chatStore.getState();
    expect(s.isOpened).toBe(false);
    expect(s.isRendered).toBe(false);
  });

  it("open() sets isOpened and isRendered to true", () => {
    chatStore.getState().open();
    expect(chatStore.getState().isOpened).toBe(true);
    expect(chatStore.getState().isRendered).toBe(true);
  });

  it("close() sets isOpened to false", () => {
    chatStore.getState().open();
    chatStore.getState().close();
    expect(chatStore.getState().isOpened).toBe(false);
  });

  it("toggle() flips isOpened", () => {
    chatStore.getState().toggle();
    expect(chatStore.getState().isOpened).toBe(true);
    chatStore.getState().toggle();
    expect(chatStore.getState().isOpened).toBe(false);
  });

  it("toggle() sets isRendered to true", () => {
    chatStore.getState().toggle();
    expect(chatStore.getState().isRendered).toBe(true);
  });

  it("setTheme merges partial theme", () => {
    chatStore.getState().setTheme({ colors: { primary: "#ff0000" } });
    expect(chatStore.getState().theme.colors.primary).toBe("#ff0000");
    expect(chatStore.getState().theme.colors.secondary).toBe(
      DEFAULT_THEME.colors.secondary
    );
  });

  it("getTheme returns the current theme", () => {
    const theme = chatStore.getState().getTheme();
    expect(theme).toEqual(DEFAULT_THEME);
  });

  it("setConnector updates activeConnector", () => {
    chatStore.getState().setConnector("websocket");
    expect(chatStore.getState().activeConnector).toBe("websocket");
  });

  it("connectorStatus starts as idle", () => {
    expect(chatStore.getState().connectorStatus).toBe("idle");
  });

  it("setConnectorStatus updates connectorStatus", () => {
    chatStore.getState().setConnectorStatus("connecting");
    expect(chatStore.getState().connectorStatus).toBe("connecting");
    chatStore.getState().setConnectorStatus("connected");
    expect(chatStore.getState().connectorStatus).toBe("connected");
    chatStore.getState().setConnectorStatus("error");
    expect(chatStore.getState().connectorStatus).toBe("error");
  });

  it("isFullscreen starts as false", () => {
    expect(chatStore.getState().isFullscreen).toBe(false);
  });

  it("toggleFullscreen flips isFullscreen", () => {
    chatStore.getState().toggleFullscreen();
    expect(chatStore.getState().isFullscreen).toBe(true);
    chatStore.getState().toggleFullscreen();
    expect(chatStore.getState().isFullscreen).toBe(false);
  });

  it("setFullscreen sets isFullscreen directly", () => {
    chatStore.getState().setFullscreen(true);
    expect(chatStore.getState().isFullscreen).toBe(true);
    chatStore.getState().setFullscreen(false);
    expect(chatStore.getState().isFullscreen).toBe(false);
  });

  it("allowFullscreen starts as true", () => {
    expect(chatStore.getState().allowFullscreen).toBe(true);
  });

  it("setAllowFullscreen updates allowFullscreen", () => {
    chatStore.getState().setAllowFullscreen(false);
    expect(chatStore.getState().allowFullscreen).toBe(false);
    chatStore.getState().setAllowFullscreen(true);
    expect(chatStore.getState().allowFullscreen).toBe(true);
  });

  it("setTheme({ allowFullscreen }) mirrors into the top-level allowFullscreen field", () => {
    // Regression: ChatHeader reads `themeState.allowFullscreen` (top-level
    // store field), not `theme.allowFullscreen`. Without this mirror, calling
    // `setTheme({ allowFullscreen: false })` (e.g. the Minimal preset) updated
    // the theme blob but left the fullscreen toggle visible in the header.
    chatStore.getState().setTheme({ allowFullscreen: false });
    expect(chatStore.getState().allowFullscreen).toBe(false);
    expect(chatStore.getState().theme.allowFullscreen).toBe(false);

    chatStore.getState().setTheme({ allowFullscreen: true });
    expect(chatStore.getState().allowFullscreen).toBe(true);
    expect(chatStore.getState().theme.allowFullscreen).toBe(true);

    // Setting unrelated fields does not touch top-level allowFullscreen.
    chatStore.getState().setAllowFullscreen(false);
    chatStore.getState().setTheme({ colors: { primary: "#ff0000" } });
    expect(chatStore.getState().allowFullscreen).toBe(false);
  });

  // ── unread / typing ────────────────────────────────────────────────

  it("incrementUnread increases unreadCount by 1 each call", () => {
    chatStore.getState().incrementUnread();
    chatStore.getState().incrementUnread();
    expect(chatStore.getState().unreadCount).toBe(2);
  });

  it("resetUnread sets unreadCount to 0", () => {
    chatStore.getState().incrementUnread();
    chatStore.getState().incrementUnread();
    chatStore.getState().resetUnread();
    expect(chatStore.getState().unreadCount).toBe(0);
  });

  it("open() resets unreadCount", () => {
    chatStore.getState().incrementUnread();
    chatStore.getState().open();
    expect(chatStore.getState().unreadCount).toBe(0);
  });

  it("setTyping updates isTyping", () => {
    chatStore.getState().setTyping(true);
    expect(chatStore.getState().isTyping).toBe(true);
    chatStore.getState().setTyping(false);
    expect(chatStore.getState().isTyping).toBe(false);
  });

  it("setTyping with durationMs auto-clears after timeout", () => {
    vi.useFakeTimers();
    chatStore.getState().setTyping(true, { durationMs: 500 });
    expect(chatStore.getState().isTyping).toBe(true);
    vi.advanceTimersByTime(499);
    expect(chatStore.getState().isTyping).toBe(true);
    vi.advanceTimersByTime(1);
    expect(chatStore.getState().isTyping).toBe(false);
    vi.useRealTimers();
  });

  it("setTyping with durationMs resets timer when called again (extend)", () => {
    vi.useFakeTimers();
    chatStore.getState().setTyping(true, { durationMs: 500 });
    vi.advanceTimersByTime(400);
    expect(chatStore.getState().isTyping).toBe(true);
    // Extend: re-apply with the same (or new) duration
    chatStore.getState().setTyping(true, { durationMs: 500 });
    vi.advanceTimersByTime(400);
    expect(chatStore.getState().isTyping).toBe(true);
    vi.advanceTimersByTime(100);
    expect(chatStore.getState().isTyping).toBe(false);
    vi.useRealTimers();
  });

  it("setTyping with untilMessage keeps typing on indefinitely", () => {
    vi.useFakeTimers();
    chatStore.getState().setTyping(true, { untilMessage: true });
    expect(chatStore.getState().isTyping).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(chatStore.getState().isTyping).toBe(true);
    vi.useRealTimers();
  });

  it("setTyping with untilMessage cancels any running duration timer", () => {
    vi.useFakeTimers();
    chatStore.getState().setTyping(true, { durationMs: 500 });
    chatStore.getState().setTyping(true, { untilMessage: true });
    vi.advanceTimersByTime(5000);
    expect(chatStore.getState().isTyping).toBe(true);
    vi.useRealTimers();
  });

  it("setTyping(false) clears any running duration timer", () => {
    vi.useFakeTimers();
    chatStore.getState().setTyping(true, { durationMs: 500 });
    chatStore.getState().setTyping(false);
    expect(chatStore.getState().isTyping).toBe(false);
    vi.advanceTimersByTime(1000);
    // Should remain false (no re-toggle to false from a stale timer).
    expect(chatStore.getState().isTyping).toBe(false);
    vi.useRealTimers();
  });

  // ── reconnect ──────────────────────────────────────────────────────

  it("setReconnectAttempt updates reconnectAttempt", () => {
    chatStore.getState().setReconnectAttempt(2);
    expect(chatStore.getState().reconnectAttempt).toBe(2);
    chatStore.getState().setReconnectAttempt(0);
    expect(chatStore.getState().reconnectAttempt).toBe(0);
  });

  // ── history ────────────────────────────────────────────────────────

  it("setHasMoreHistory updates hasMoreHistory", () => {
    chatStore.getState().setHasMoreHistory(true);
    expect(chatStore.getState().hasMoreHistory).toBe(true);
    chatStore.getState().setHasMoreHistory(false);
    expect(chatStore.getState().hasMoreHistory).toBe(false);
  });

  it("setIsLoadingHistory updates isLoadingHistory", () => {
    chatStore.getState().setIsLoadingHistory(true);
    expect(chatStore.getState().isLoadingHistory).toBe(true);
    chatStore.getState().setIsLoadingHistory(false);
    expect(chatStore.getState().isLoadingHistory).toBe(false);
  });

  it("setHistoryCursor updates historyCursor", () => {
    chatStore.getState().setHistoryCursor("page2");
    expect(chatStore.getState().historyCursor).toBe("page2");
    chatStore.getState().setHistoryCursor(undefined);
    expect(chatStore.getState().historyCursor).toBeUndefined();
  });

  // ── search ─────────────────────────────────────────────────────────

  it("setSearchQuery updates searchQuery", () => {
    chatStore.getState().setSearchQuery("hello");
    expect(chatStore.getState().searchQuery).toBe("hello");
  });

  it("setSearchQuery emits search_query_changed event", () => {
    const handler = vi.fn();
    EventBus.on("search_query_changed", handler);
    chatStore.getState().setSearchQuery("test");
    expect(handler).toHaveBeenCalledWith({ query: "test" });
    EventBus.off("search_query_changed", handler);
  });

  it("clearSearch resets searchQuery to empty string", () => {
    chatStore.getState().setSearchQuery("something");
    chatStore.getState().clearSearch();
    expect(chatStore.getState().searchQuery).toBe("");
  });

  it("clearSearch emits search_query_changed with empty query", () => {
    const handler = vi.fn();
    EventBus.on("search_query_changed", handler);
    chatStore.getState().clearSearch();
    expect(handler).toHaveBeenCalledWith({ query: "" });
    EventBus.off("search_query_changed", handler);
  });

  // ── EventBus integration ───────────────────────────────────────────

  it("open() emits widget_opened event", () => {
    const handler = vi.fn();
    EventBus.on("widget_opened", handler);
    chatStore.getState().open();
    expect(handler).toHaveBeenCalledOnce();
    EventBus.off("widget_opened", handler);
  });

  it("close() emits widget_closed event", () => {
    const handler = vi.fn();
    EventBus.on("widget_closed", handler);
    chatStore.getState().close();
    expect(handler).toHaveBeenCalledOnce();
    EventBus.off("widget_closed", handler);
  });

  // ── subscribe ──────────────────────────────────────────────────────

  it("subscribe() fires callback on state change and returns unsubscribe fn", () => {
    const cb = vi.fn();
    const unsub = chatStore.getState().subscribe(cb);
    chatStore.getState().setTyping(true);
    expect(cb).toHaveBeenCalled();
    unsub();
    cb.mockClear();
    chatStore.getState().setTyping(false);
    expect(cb).not.toHaveBeenCalled();
  });
});
