/**
 * Shared helpers for @chativa/ui component tests.
 *
 * Not a test file itself (no `.test.ts` suffix) — vitest only collects
 * `*.test.ts`, and coverage excludes everything under `__tests__/`.
 */
import { vi } from "vitest";
import {
  chatStore,
  messageStore,
  conversationStore,
  ConnectorRegistry,
  SlashCommandRegistry,
  MessageActionRegistry,
  DEFAULT_THEME,
  type IConnector,
  type MessageHandler,
  type ConnectHandler,
  type DisconnectHandler,
  type TypingHandler,
  type ProgressHandler,
  type ConversationHandler,
  type IncomingMessage,
  type HistoryResult,
  type Conversation,
  type ToolCallHandler,
  type ToolCall,
} from "@chativa/core";

export type LitLike = HTMLElement & { updateComplete: Promise<unknown> };

/** Create a custom element, optionally assign properties, append it to the body and wait for its first render. */
export async function mount<T extends LitLike = LitLike>(
  tag: string,
  props: Record<string, unknown> = {},
): Promise<T> {
  const el = document.createElement(tag) as T;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

/** Shorthand for `el.shadowRoot.querySelector`. */
export function $<E extends Element = HTMLElement>(el: Element, selector: string): E | null {
  return el.shadowRoot!.querySelector<E>(selector);
}

export function $$<E extends Element = HTMLElement>(el: Element, selector: string): E[] {
  return [...el.shadowRoot!.querySelectorAll<E>(selector)];
}

/** Let pending promise callbacks (engine init, connector calls) run. */
export async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

export type FakeConnector = IConnector & {
  emitMessage: (msg: Partial<IncomingMessage> & { id: string }) => void;
  emitDisconnect: (reason?: string) => void;
  emitTyping: (v: boolean) => void;
  emitProgress: (message: string | null) => void;
  emitToolCall: (tc: ToolCall) => void;
  emitConversationUpdate: (c: Conversation) => void;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  sendFeedback: ReturnType<typeof vi.fn>;
  sendSurvey: ReturnType<typeof vi.fn>;
  sendFile: ReturnType<typeof vi.fn>;
  loadHistory: ReturnType<typeof vi.fn>;
  receiveComponentEvent: ReturnType<typeof vi.fn>;
  listConversations: ReturnType<typeof vi.fn>;
  createConversation: ReturnType<typeof vi.fn>;
  switchConversation: ReturnType<typeof vi.fn>;
  closeConversation: ReturnType<typeof vi.fn>;
};

/**
 * In-memory IConnector double. Every port method is a `vi.fn` so tests can
 * assert on what the UI forwarded, and `emit*` helpers drive the callbacks
 * ChatEngine registers.
 */
export function createFakeConnector(
  name = "fake",
  opts: { history?: HistoryResult; conversations?: Conversation[] } = {},
): FakeConnector {
  let onMsg: MessageHandler | null = null;
  let onDisc: DisconnectHandler | null = null;
  let onTyp: TypingHandler | null = null;
  let onProg: ProgressHandler | null = null;
  let onTool: ToolCallHandler | null = null;
  let onConv: ConversationHandler | null = null;
  const conversations = opts.conversations;

  const connector = {
    name,
    addSentToHistory: true,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendFeedback: vi.fn().mockResolvedValue(undefined),
    sendSurvey: vi.fn().mockResolvedValue(undefined),
    sendFile: vi.fn().mockResolvedValue(undefined),
    loadHistory: vi
      .fn()
      .mockResolvedValue(opts.history ?? { messages: [], hasMore: false }),
    receiveComponentEvent: vi.fn(),
    listConversations: vi.fn().mockResolvedValue(conversations ?? []),
    createConversation: vi.fn().mockImplementation(async (title?: string) => ({
      id: `conv-${Math.random().toString(36).slice(2, 8)}`,
      title: title ?? "New",
      status: "open",
    })),
    switchConversation: vi.fn().mockResolvedValue(undefined),
    closeConversation: vi.fn().mockResolvedValue(undefined),
    onMessage(cb: MessageHandler) { onMsg = cb; },
    onConnect(_cb: ConnectHandler) { /* not used by ChatEngine */ },
    onDisconnect(cb: DisconnectHandler) { onDisc = cb; },
    onTyping(cb: TypingHandler) { onTyp = cb; },
    onProgress(cb: ProgressHandler) { onProg = cb; },
    onToolCall(cb: ToolCallHandler) { onTool = cb; },
    onConversationUpdate(cb: ConversationHandler) { onConv = cb; },
    emitMessage(msg: Partial<IncomingMessage> & { id: string }) {
      onMsg?.({ type: "text", data: {}, ...msg } as IncomingMessage);
    },
    emitDisconnect(reason?: string) { onDisc?.(reason); },
    emitTyping(v: boolean) { onTyp?.(v); },
    emitProgress(message: string | null) { onProg?.(message ? { message } : null); },
    emitToolCall(tc: ToolCall) { onTool?.(tc); },
    emitConversationUpdate(c: Conversation) { onConv?.(c); },
  };
  if (!conversations) {
    // Single-conversation connectors don't implement the multi-conversation port.
    delete (connector as Partial<typeof connector>).listConversations;
  }
  return connector as unknown as FakeConnector;
}

/** Register a fake connector, replacing any previous one with the same name. */
export function registerFakeConnector(
  name = "fake",
  opts?: Parameters<typeof createFakeConnector>[1],
): FakeConnector {
  ConnectorRegistry.unregister(name);
  const c = createFakeConnector(name, opts);
  ConnectorRegistry.register(c);
  return c;
}

/** Reset every global store / registry the UI reads from, and empty the DOM. */
export function resetGlobals(): void {
  document.body.innerHTML = "";
  chatStore.getState().setTyping(false); // also clears any pending auto-clear timer
  chatStore.setState({
    isOpened: false,
    isRendered: false,
    isFullscreen: false,
    allowFullscreen: true,
    activeConnector: "dummy",
    connectorStatus: "idle",
    isTyping: false,
    typingMessage: null,
    unreadCount: 0,
    reconnectAttempt: 0,
    theme: DEFAULT_THEME,
    hasMoreHistory: false,
    isLoadingHistory: false,
    historyCursor: undefined,
    searchQuery: "",
    activeToolCalls: [],
    messageActionSupport: { regenerate: "unsupported", editMessage: "unsupported" },
  });
  messageStore.getState().clear();
  conversationStore.getState().setConversations([]);
  conversationStore.getState().setActive(null);
  ConnectorRegistry.clear();
  SlashCommandRegistry.clear();
  MessageActionRegistry.clear();
}
