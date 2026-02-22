import { createStore } from "zustand/vanilla";
import { DEFAULT_THEME, mergeTheme, type ThemeConfig } from "../../domain/value-objects/Theme";
import type { DeepPartial } from "../../domain/value-objects/Theme";

// Re-export for backwards compatibility
export type { ThemeConfig };

export interface ChatStoreState {
  isOpened: boolean;
  isRendered: boolean;
  activeConnector: string;
  theme: ThemeConfig;

  toggle: () => void;
  open: () => void;
  close: () => void;

  setTheme: (theme: DeepPartial<ThemeConfig>) => void;
  getTheme: () => ThemeConfig;
  setConnector: (name: string) => void;
  subscribe: (cb: () => void) => () => void;
}

// Re-export for downstream consumers
export type { DeepPartial };

const store = createStore<ChatStoreState>((setState, getState) => ({
  isOpened: false,
  isRendered: false,
  activeConnector: "dummy",
  theme: DEFAULT_THEME,

  toggle: () =>
    setState((s) => ({
      isOpened: !s.isOpened,
      isRendered: true,
    })),

  open: () => setState(() => ({ isOpened: true, isRendered: true })),
  close: () => setState(() => ({ isOpened: false })),

  setTheme: (overrides) =>
    setState((s) => ({ theme: mergeTheme(s.theme, overrides) })),

  getTheme: () => getState().theme,

  setConnector: (name: string) => setState(() => ({ activeConnector: name })),

  subscribe: (cb: () => void): (() => void) =>
    store.subscribe(() => cb()),
}));

export default store;
