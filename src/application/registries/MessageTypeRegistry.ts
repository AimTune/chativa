/**
 * MessageTypeRegistry — maps message type strings to LitElement component constructors.
 *
 * Application layer: imports only from domain.
 */

type ComponentConstructor = typeof HTMLElement;

let fallbackComponent: ComponentConstructor | null = null;

const registry = new Map<string, ComponentConstructor>();

export const MessageTypeRegistry = {
  /**
   * Register a component constructor for a message type.
   * @param type  The message type key (e.g. "text", "card", "image")
   * @param component  The LitElement class to render for this type
   */
  register(type: string, component: ComponentConstructor): void {
    registry.set(type, component);
  },

  /**
   * Resolve a component for a given type.
   * Falls back to the registered fallback component (DefaultTextMessage).
   */
  resolve(type: string): ComponentConstructor {
    const component = registry.get(type);
    if (component) return component;
    if (fallbackComponent) return fallbackComponent;
    throw new Error(
      `MessageTypeRegistry: no component for type "${type}" and no fallback registered.`
    );
  },

  /**
   * Register the fallback component shown when no type match is found.
   */
  setFallback(component: ComponentConstructor): void {
    fallbackComponent = component;
  },

  has(type: string): boolean {
    return registry.has(type);
  },

  unregister(type: string): void {
    registry.delete(type);
  },

  /** For testing only. */
  clear(): void {
    registry.clear();
    fallbackComponent = null;
  },

  list(): string[] {
    return [...registry.keys()];
  },
};
