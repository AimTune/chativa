import {
  chatStore,
  messageStore,
  ConnectorRegistry,
  type IConnector,
  type ConnectorCapabilities,
} from "@chativa/core";
import { DummyConnector, type DummyRule } from "@chativa/connector-dummy";

// ── Shared DummyConnector options ─────────────────────────────────────
// The Connector tab owns the delays, the Rules tab owns the rule set and the
// Config tab can import both — they all read/write this one shared object so
// rebuilding the dummy from any tab keeps the others' settings.

export interface SandboxDummyOptions {
  replyDelay: number;
  connectDelay: number;
  rules: DummyRule[];
  /** Simulated server permissions for regenerate / edit. `{}` = both allowed. */
  capabilities: ConnectorCapabilities;
}

/** Mirrors the instance `main.ts` registers on page load. */
let _dummyOptions: SandboxDummyOptions = { replyDelay: 500, connectDelay: 2000, rules: [], capabilities: {} };
const _listeners = new Set<(opts: SandboxDummyOptions) => void>();

export function getDummyOptions(): SandboxDummyOptions {
  return _dummyOptions;
}

export function setDummyOptions(patch: Partial<SandboxDummyOptions>): void {
  _dummyOptions = { ..._dummyOptions, ...patch };
  for (const fn of _listeners) fn(_dummyOptions);
}

export function subscribeDummyOptions(fn: (opts: SandboxDummyOptions) => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** Build a fresh DummyConnector from the shared options. */
export function buildDummyConnector(name?: string): DummyConnector {
  const o = _dummyOptions;
  return new DummyConnector({
    name,
    replyDelay: Number(o.replyDelay) || 0,
    connectDelay: Number(o.connectDelay) || 0,
    rules: o.rules,
    capabilities: o.capabilities,
  });
}

/**
 * Simulate the server allowing or refusing regenerate / edit: stored in the
 * shared options (so a rebuilt dummy keeps it) and pushed to the live dummy,
 * whose `onCapabilities` announcement updates the widget immediately.
 */
export function setDummyCapabilities(patch: ConnectorCapabilities): void {
  const capabilities = { ..._dummyOptions.capabilities, ...patch };
  setDummyOptions({ capabilities });
  activeDummy()?.setCapabilities(capabilities);
}

// ── Demo hooks ────────────────────────────────────────────────────────

/**
 * Point the window-level demo hooks (Messages / GenUI / tool-call buttons) at
 * `connector`. Called on page load and again whenever a new dummy is swapped
 * in, so the demo buttons keep talking to the live instance.
 */
export function bindDummyDemoHooks(connector: DummyConnector): void {
  const w = window as unknown as Record<string, unknown>;
  w.chativaInject = connector.injectMessage.bind(connector);
  w.chativaGenUI = (command: string) => connector.triggerGenUI(command);
  w.chativaToolDemo = (scenario: "success" | "error" | "multi" | "genui") =>
    connector.triggerToolCalls(scenario);
}

// ── Swap path ─────────────────────────────────────────────────────────

/**
 * Register `instance`, make it the active connector, wipe the previous
 * session's runtime state and re-mount `<chat-iva>` so the engine re-binds.
 */
export function swapConnector(instance: IConnector): void {
  // Replace any same-named instance in the registry with the new one.
  ConnectorRegistry.register(instance);
  chatStore.getState().setConnector(instance.name);

  if (instance instanceof DummyConnector) bindDummyDemoHooks(instance);

  // Wipe runtime state from the previous session so the new connector
  // starts clean (mirrors what ChatWidget._resetConversation does after
  // a survey submit).
  messageStore.getState().clear();
  chatStore.setState({
    connectorStatus: "idle",
    isTyping: false,
    unreadCount: 0,
    reconnectAttempt: 0,
    hasMoreHistory: false,
    isLoadingHistory: false,
    historyCursor: undefined,
    searchQuery: "",
    isRendered: false,
    activeToolCalls: [],
  });

  // Replace the <chat-iva> element so its connectedCallback re-binds
  // the engine to the newly registered adapter. ChatWidget.disconnectedCallback
  // calls _multiEngine.destroy(), which disconnects the old connector.
  const old = document.querySelector("chat-iva");
  if (old?.parentNode) {
    const fresh = document.createElement(old.tagName.toLowerCase());
    for (const attr of Array.from(old.attributes)) {
      fresh.setAttribute(attr.name, attr.value);
    }
    old.parentNode.replaceChild(fresh, old);
  }
}

/** The active connector, if it is a DummyConnector. */
export function activeDummy(): DummyConnector | undefined {
  const name = chatStore.getState().activeConnector;
  const c = name ? ConnectorRegistry.get(name) : undefined;
  return c instanceof DummyConnector ? c : undefined;
}
