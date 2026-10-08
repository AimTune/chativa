import { ConnectorRegistry, type IConnector } from "@chativa/core";

/**
 * Accepts either a registered connector name or an `IConnector` instance.
 * Instances are auto-registered (idempotent — safe to call from every effect
 * run) so `<ChatIva connector={dummy} />` works without a separate
 * `ConnectorRegistry.register(dummy)` call. Returns the resolved name.
 */
export function resolveConnectorName(
  connector: string | IConnector | undefined,
): string | undefined {
  if (connector === undefined) return undefined;
  if (typeof connector === "string") return connector;
  if (!ConnectorRegistry.has(connector.name)) {
    ConnectorRegistry.register(connector);
  }
  return connector.name;
}

/** The connector's name, without registering anything (pure — safe in `$derived`). */
export function connectorNameOf(connector: string | IConnector | undefined): string | undefined {
  return typeof connector === "string" ? connector : connector?.name;
}
