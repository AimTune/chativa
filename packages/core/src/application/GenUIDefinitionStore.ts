import type { GenUIComponentDefinition } from "../domain/entities/GenUI";

type Subscriber = (definitions: GenUIComponentDefinition[]) => void;

const _definitions = new Map<string, GenUIComponentDefinition>();
const _subscribers = new Set<Subscriber>();

const keyOf = (d: GenUIComponentDefinition) => `${d.name}@${d.version ?? "1"}`;

/**
 * Where server-defined GenUI components land between the connector and the
 * renderer.
 *
 * The layering forbids the direct call: `@chativa/core` must not import
 * `GenUIRegistry` from `@chativa/genui`, and a connector must not know a
 * registry exists at all. So the connector publishes definitions here (via
 * ChatEngine) and `@chativa/genui` subscribes — each side depends only on core.
 *
 * Subscribers get an immediate replay of everything already published, because
 * the connector may well have connected before the GenUI bundle finished
 * loading.
 */
export const genUIDefinitionStore = {
  /**
   * Publish a catalog. Definitions already known by `name@version` are dropped,
   * so a reconnect that re-announces the same catalog notifies nobody.
   *
   * @returns the definitions that were actually new.
   */
  publish(definitions: GenUIComponentDefinition[]): GenUIComponentDefinition[] {
    const fresh = definitions.filter(
      (d) => d && typeof d.name === "string" && d.name && !_definitions.has(keyOf(d))
    );
    if (fresh.length === 0) return [];
    for (const d of fresh) _definitions.set(keyOf(d), d);
    for (const cb of _subscribers) cb(fresh);
    return fresh;
  },

  /**
   * Subscribe to published definitions; the callback fires once immediately
   * with everything published so far. Returns an unsubscribe function.
   */
  subscribe(cb: Subscriber): () => void {
    _subscribers.add(cb);
    const known = Array.from(_definitions.values());
    if (known.length > 0) cb(known);
    return () => { _subscribers.delete(cb); };
  },

  /** Everything published so far. */
  list(): GenUIComponentDefinition[] {
    return Array.from(_definitions.values());
  },

  has(name: string, version?: string): boolean {
    return _definitions.has(`${name}@${version ?? "1"}`);
  },

  /** Reset — for use in tests only. */
  clear(): void {
    _definitions.clear();
    _subscribers.clear();
  },
};
