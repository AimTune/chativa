import { ConnectorRegistry, type IConnector } from "@chativa/core";

/**
 * Accepts either a registered connector name or an `IConnector` instance.
 * Instances are auto-registered (idempotent — safe to call from `setup()` and
 * from watchers) so `<ChatIva :connector="dummy" />` works without a separate
 * `ConnectorRegistry.register(dummy)` call. Returns the resolved name to hand
 * down to the underlying `<chat-iva>` element's `connector` property.
 */
export function resolveConnectorName(
  connector: string | IConnector | undefined | null,
): string | undefined {
  if (connector === undefined || connector === null) return undefined;
  if (typeof connector === "string") return connector;
  if (!ConnectorRegistry.has(connector.name)) {
    ConnectorRegistry.register(connector);
  }
  return connector.name;
}
