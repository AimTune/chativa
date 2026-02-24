import { createStore } from "zustand/vanilla";
import { DEFAULT_THEME, mergeTheme, type ThemeConfig } from "../../domain/value-objects/Theme";
import type { DeepPartial } from "../../domain/value-objects/Theme";

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

  toggle: () =>
    setState((s) => ({
      isOpened: !s.isOpened,
      isRendered: true,
      unreadCount: 0,
    })),

  open: () => setState(() => ({ isOpened: true, isRendered: true, unreadCount: 0 })),
  close: () => setState(() => ({ isOpened: false })),

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

  subscribe: (cb: () => void): (() => void) =>
    store.subscribe(() => cb()),
}));

export default store;
