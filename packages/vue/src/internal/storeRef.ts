import { computed, getCurrentScope, onScopeDispose, shallowRef, type ComputedRef } from "vue";
import { canUseDOM } from "./env";

/** The slice of a zustand vanilla store this package relies on. */
export interface ReadableStore<S> {
  getState(): S;
  subscribe(listener: (state: S, prevState: S) => void): () => void;
}

/**
 * Mirrors a zustand vanilla store into a read-only Vue ref.
 *
 * The ref holds the store's state object as-is (`shallowRef` — no deep proxy,
 * so message objects keep their identity) and is replaced on every store
 * update. The subscription is released when the calling effect scope (a
 * component's `setup()`, or a manual `effectScope()`) is disposed.
 *
 * During server rendering it returns a static snapshot and never subscribes,
 * so a Nuxt request can't leak a listener onto the module-level store.
 */
export function useStoreRef<S>(store: ReadableStore<S>): ComputedRef<S> {
  const state = shallowRef(store.getState());
  if (canUseDOM()) {
    const unsubscribe = store.subscribe((next) => {
      state.value = next;
    });
    if (getCurrentScope()) onScopeDispose(unsubscribe);
  }
  return computed(() => state.value);
}
