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
  theme: DEFAULT_THEME,

  toggle: () =>
    setState((s) => ({
      isOpened: !s.isOpened,
      isRendered: true,
    })),

  open: () => setState(() => ({ isOpened: true, isRendered: true })),
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

  subscribe: (cb: () => void): (() => void) =>
    store.subscribe(() => cb()),
}));

export default store;
