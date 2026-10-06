import { ConnectorRegistry, type IConnector } from "@chativa/core";

/**
 * Accepts either a registered connector name or an `IConnector` instance.
 * Instances are auto-registered (idempotent — safe to call on every input
 * change) so `[connector]="dummy"` works without a separate
 * `ConnectorRegistry.register(dummy)` call. Returns the resolved name.
 */
export function resolveConnectorName(
  connector: string | IConnector | null | undefined,
): string | undefined {
  if (connector === undefined || connector === null) return undefined;
  if (typeof connector === "string") return connector;
  if (!ConnectorRegistry.has(connector.name)) {
    ConnectorRegistry.register(connector);
  }
  return connector.name;
}
