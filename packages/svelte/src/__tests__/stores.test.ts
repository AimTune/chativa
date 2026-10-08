import { describe, it, expect, vi, afterEach } from "vitest";
import { get } from "svelte/store";
import { chatStore, messageStore, type StoredMessage } from "@chativa/core";
import { chatState, messageState, messages, toReadable } from "../stores";
import * as env from "../internal/env";

vi.mock("../internal/env", { spy: true });

/** Minimal stand-in for zustand's `createStore` (zustand is not a direct dependency here). */
function createStore<S extends object>(init: () => S) {
  let state = init();
  const listeners = new Set<(state: S, prev: S) => void>();
  return {
    getState: () => state,
    setState(patch: Partial<S>) {
      const prev = state;
      state = { ...state, ...patch };
      listeners.forEach((l) => l(state, prev));
    },
    subscribe(listener: (state: S, prev: S) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const msg = (id: string): StoredMessage => ({
  id,
  type: "text",
  data: { text: id },
  timestamp: Date.now(),
});

afterEach(() => {
  messageStore.getState().clear();
  vi.mocked(env.isBrowser).mockRestore();
});

describe("chatState", () => {
  it("mirrors chatStore and updates subscribers", () => {
    const seen: boolean[] = [];
    const unsubscribe = chatState.subscribe((s) => seen.push(s.isOpened));

    chatStore.getState().open();
    chatStore.getState().close();
    unsubscribe();
    chatStore.getState().open();

    expect(seen).toEqual([false, true, false]);
    chatStore.getState().close();
  });
});

describe("messages / messageState", () => {
  it("mirrors the messageStore message list", () => {
    const unsubscribe = messages.subscribe(() => {});
    messageStore.getState().addMessage(msg("a"));
    messageStore.getState().addMessage(msg("b"));

    expect(get(messages).map((m) => m.id)).toEqual(["a", "b"]);
    expect(get(messageState).version).toBe(messageStore.getState().version);
    unsubscribe();
  });

  it("only notifies when the selected slice changes", () => {
    const listener = vi.fn();
    const unsubscribe = messages.subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);

    // Unrelated state changes keep the same `messages` array reference.
    messageStore.setState({ version: 999 });
    expect(listener).toHaveBeenCalledTimes(1);

    messageStore.getState().addMessage(msg("c"));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

describe("toReadable", () => {
  it("wraps any zustand vanilla store, with or without a selector", () => {
    const store = createStore<{ count: number; label: string }>(() => ({ count: 0, label: "x" }));
    const whole = toReadable(store);
    const count = toReadable(store, (s) => s.count);

    const counts: number[] = [];
    const unsubscribe = count.subscribe((c) => counts.push(c));
    store.setState({ count: 1 });
    store.setState({ label: "y" });
    store.setState({ count: 2 });
    unsubscribe();

    expect(counts).toEqual([0, 1, 2]);
    expect(get(whole)).toEqual({ count: 2, label: "y" });
  });

  it("yields a snapshot but never subscribes to zustand on the server", () => {
    vi.mocked(env.isBrowser).mockReturnValue(false);
    const store = createStore<{ count: number }>(() => ({ count: 7 }));
    const spy = vi.spyOn(store, "subscribe");

    const count = toReadable(store, (s) => s.count);
    const seen: number[] = [];
    const unsubscribe = count.subscribe((c) => seen.push(c));
    store.setState({ count: 8 });
    unsubscribe();

    expect(seen).toEqual([7]);
    expect(spy).not.toHaveBeenCalled();
  });
});
