import { createStore } from "zustand/vanilla";
import { DEFAULT_THEME, mergeTheme, type ThemeConfig } from "../../domain/value-objects/Theme";
import type { DeepPartial } from "../../domain/value-objects/Theme";
import { EventBus } from "../EventBus";

// Re-export for backwards compatibility
export type { ThemeConfig };

export type ConnectorStatus = "idle" | "connecting" | "connected" | "error" | "disconnected";

export interface ChatStoreState {
  isOpened: boolean;
  isRendered: boolean;
  isFullscreen: boolean;
  /** When false the fullscreen toggle button in the header is hidden. */
  allowFullscreen: boolean;
  activeConnector: string;
  connectorStatus: ConnectorStatus;
  /** True while the remote peer (bot) is composing a reply. */
  isTyping: boolean;
  /** Number of unread messages received while the chat was closed. */
  unreadCount: number;
  /** Current auto-reconnect attempt (0 = not reconnecting). */
  reconnectAttempt: number;
  theme: ThemeConfig;
  /** Whether the connector has older messages to load. */
  hasMoreHistory: boolean;
  /** True while a history page is being fetched. */
  isLoadingHistory: boolean;
  /** Opaque cursor for the next history page. */
  historyCursor?: string;
  /** Current search query; empty string means no active search. */
  searchQuery: string;

  toggle: () => void;
  open: () => void;
  close: () => void;
  toggleFullscreen: () => void;
  setFullscreen: (v: boolean) => void;
  setAllowFullscreen: (v: boolean) => void;

  setTheme: (theme: DeepPartial<ThemeConfig>) => void;
  getTheme: () => ThemeConfig;
  setConnector: (name: string) => void;
  setConnectorStatus: (status: ConnectorStatus) => void;
  setTyping: (v: boolean) => void;
  incrementUnread: () => void;
  resetUnread: () => void;
  setReconnectAttempt: (n: number) => void;
  setHasMoreHistory: (v: boolean) => void;
  setIsLoadingHistory: (v: boolean) => void;
  setHistoryCursor: (cursor: string | undefined) => void;
  setSearchQuery: (q: string) => void;
  clearSearch: () => void;
  subscribe: (cb: () => void) => () => void;
}

// Re-export for downstream consumers
export type { DeepPartial };

const store = createStore<ChatStoreState>((setState, getState) => ({
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
  showMessageStatus: true,
  searchQuery: "",

  toggle: () => {
    setState((s) => ({
      isOpened: !s.isOpened,
      isRendered: true,
      unreadCount: 0,
    }));
    EventBus.emit(getState().isOpened ? "widget_opened" : "widget_closed", undefined);
  },

  open: () => {
    setState(() => ({ isOpened: true, isRendered: true, unreadCount: 0 }));
    EventBus.emit("widget_opened", undefined);
  },

  close: () => {
    setState(() => ({ isOpened: false }));
    EventBus.emit("widget_closed", undefined);
  },

  toggleFullscreen: () =>
    setState((s) => ({ isFullscreen: !s.isFullscreen })),

  setFullscreen: (v: boolean) => setState(() => ({ isFullscreen: v })),

  setAllowFullscreen: (v: boolean) => setState(() => ({ allowFullscreen: v })),

  setTheme: (overrides) =>
    setState((s) => ({ theme: mergeTheme(s.theme, overrides) })),

  getTheme: () => getState().theme,

  setConnector: (name: string) => setState(() => ({ activeConnector: name })),

  setConnectorStatus: (status: ConnectorStatus) =>
    setState(() => ({ connectorStatus: status })),

  setTyping: (v: boolean) => setState(() => ({ isTyping: v })),

  incrementUnread: () => setState((s) => ({ unreadCount: s.unreadCount + 1 })),
  resetUnread: () => setState(() => ({ unreadCount: 0 })),
  setReconnectAttempt: (n: number) => setState(() => ({ reconnectAttempt: n })),
  setHasMoreHistory: (v: boolean) => setState(() => ({ hasMoreHistory: v })),
  setIsLoadingHistory: (v: boolean) => setState(() => ({ isLoadingHistory: v })),
  setHistoryCursor: (cursor: string | undefined) => setState(() => ({ historyCursor: cursor })),

  setSearchQuery: (q: string) => {
    setState(() => ({ searchQuery: q }));
    EventBus.emit("search_query_changed", { query: q });
  },

  clearSearch: () => {
    setState(() => ({ searchQuery: "" }));
    EventBus.emit("search_query_changed", { query: "" });
  },

  subscribe: (cb: () => void): (() => void) =>
    store.subscribe(() => cb()),
}));

export default store;
