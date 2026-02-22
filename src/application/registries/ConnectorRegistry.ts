import type { IConnector } from "../../domain/ports/IConnector";

const registry = new Map<string, IConnector>();

export const ConnectorRegistry = {
  register(connector: IConnector): void {
    if (registry.has(connector.name)) {
      throw new Error(
        `ConnectorRegistry: connector "${connector.name}" is already registered. ` +
          `Call ConnectorRegistry.unregister("${connector.name}") first.`
      );
    }
    registry.set(connector.name, connector);
  },

  get(name: string): IConnector {
    const connector = registry.get(name);
    if (!connector) {
      throw new Error(
        `ConnectorRegistry: connector "${name}" not found. ` +
          `Available: [${[...registry.keys()].join(", ")}]`
      );
    }
    return connector;
  },

  has(name: string): boolean {
    return registry.has(name);
  },

  unregister(name: string): void {
    registry.delete(name);
  },

  /** For testing only — clears all registered connectors. */
  clear(): void {
    registry.clear();
  },

  list(): string[] {
    return [...registry.keys()];
  },
};
