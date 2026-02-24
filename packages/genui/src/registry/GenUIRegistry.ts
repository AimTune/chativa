/**
 * GenUIRegistry — maps component names to LitElement constructors.
 *
 * Register your custom components once at app startup:
 *
 *   import { GenUIRegistry } from "@chativa/genui";
 *   GenUIRegistry.register("weather", WeatherWidget, {
 *     schema: z.object({ city: z.string(), temp: z.number() }),
 *   });
 *
 * The connector can then send `{ type: "ui", component: "weather", props: {...} }`.
 */

export interface GenUISchema {
  /** Validates props at render time. Compatible with zod, yup, or any library
   *  that exposes `.safeParse(value)`. */
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

export interface GenUIEntry {
  component: typeof HTMLElement;
  schema?: GenUISchema;
}

const _registry = new Map<string, GenUIEntry>();

export const GenUIRegistry = {
  /**
   * Register a LitElement constructor under a name.
   * @param name      Must match `AIChunkUI.component` sent by the connector.
   * @param component LitElement constructor (or any HTMLElement subclass).
   * @param opts.schema  Optional schema for prop validation at render time.
   */
  register(
    name: string,
    component: typeof HTMLElement,
    opts?: { schema?: GenUISchema }
  ): void {
    _registry.set(name, { component, schema: opts?.schema });
  },

  /** Resolve a registered entry, or undefined if not found. */
  resolve(name: string): GenUIEntry | undefined {
    return _registry.get(name);
  },

  has(name: string): boolean {
    return _registry.has(name);
  },

  /** Remove a registration. */
  unregister(name: string): void {
    _registry.delete(name);
  },

  /** List all registered names. */
  list(): string[] {
    return Array.from(_registry.keys());
  },

  /** Reset — for use in tests only. */
  clear(): void {
    _registry.clear();
  },
};
