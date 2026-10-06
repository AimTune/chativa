import { computed, type ComputedRef } from "vue";
import {
  chatStore,
  type ChatStoreState,
  type ConnectorStatus,
  type DeepPartial,
  type IConnector,
  type ThemeConfig,
  type ToolCall,
} from "@chativa/core";
import { useStoreRef } from "../internal/storeRef";
import { resolveConnectorName } from "../internal/resolveConnector";

/** Return value of {@link useChat}. */
export interface UseChatReturn {
  /** The whole `chatStore` state, replaced on every store update. */
  state: ComputedRef<ChatStoreState>;
  isOpened: ComputedRef<boolean>;
  isFullscreen: ComputedRef<boolean>;
  activeConnector: ComputedRef<string>;
  connectorStatus: ComputedRef<ConnectorStatus>;
  /** True while the bot is composing a reply. */
  isTyping: ComputedRef<boolean>;
  /** Backend-supplied progress text for the current reply (`IConnector.onProgress`), if any. */
  typingMessage: ComputedRef<string | null>;
  unreadCount: ComputedRef<number>;
  reconnectAttempt: ComputedRef<number>;
  theme: ComputedRef<ThemeConfig>;
  searchQuery: ComputedRef<string>;
  /** Tool calls reported for the reply currently being produced. */
  activeToolCalls: ComputedRef<ToolCall[]>;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setFullscreen: (value: boolean) => void;
  setTheme: (theme: DeepPartial<ThemeConfig>) => void;
  /** Activate a connector by name, or auto-register and activate an `IConnector` instance. */
  setConnector: (connector: string | IConnector) => void;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  resetUnread: () => void;
}

/**
 * Reactive view of the shared `chatStore` — widget open/fullscreen state,
 * connector status, typing indicator, unread count, theme — plus its actions.
 * Every `<ChatIva>` on the page reads the same store, so this works anywhere
 * in the app, not only beneath a widget.
 *
 * Call it from `setup()` (or inside an `effectScope()`): the store
 * subscription is released when that scope is disposed.
 *
 * @example
 * ```ts
 * const { isOpened, connectorStatus, toggle } = useChat();
 * ```
 */
export function useChat(): UseChatReturn {
  const state = useStoreRef(chatStore);
  const pick = <K extends keyof ChatStoreState>(key: K) =>
    computed<ChatStoreState[K]>(() => state.value[key]);

  return {
    state,
    isOpened: pick("isOpened"),
    isFullscreen: pick("isFullscreen"),
    activeConnector: pick("activeConnector"),
    connectorStatus: pick("connectorStatus"),
    isTyping: pick("isTyping"),
    typingMessage: pick("typingMessage"),
    unreadCount: pick("unreadCount"),
    reconnectAttempt: pick("reconnectAttempt"),
    theme: pick("theme"),
    searchQuery: pick("searchQuery"),
    activeToolCalls: pick("activeToolCalls"),
    open: () => chatStore.getState().open(),
    close: () => chatStore.getState().close(),
    toggle: () => chatStore.getState().toggle(),
    setFullscreen: (value) => chatStore.getState().setFullscreen(value),
    setTheme: (theme) => chatStore.getState().setTheme(theme),
    setConnector: (connector) => {
      const name = resolveConnectorName(connector);
      if (name !== undefined) chatStore.getState().setConnector(name);
    },
    setSearchQuery: (query) => chatStore.getState().setSearchQuery(query),
    clearSearch: () => chatStore.getState().clearSearch(),
    resetUnread: () => chatStore.getState().resetUnread(),
  };
}
