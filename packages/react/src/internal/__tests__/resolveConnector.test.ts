import { describe, it, expect, afterEach, vi } from "vitest";
import { ConnectorRegistry, type IConnector } from "@chativa/core";
import { resolveConnectorName } from "../resolveConnector";

function makeFakeConnector(name: string): IConnector {
  return {
    name,
    async connect() {},
    async disconnect() {},
    async sendMessage() {},
    onMessage() {},
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  ["resolve-a", "resolve-b"].forEach((n) => {
    if (ConnectorRegistry.has(n)) ConnectorRegistry.unregister(n);
  });
});

describe("resolveConnectorName", () => {
  it("returns undefined for no connector", () => {
    expect(resolveConnectorName(undefined)).toBeUndefined();
  });

  it("returns a string name unchanged without touching the registry", () => {
    const registerSpy = vi.spyOn(ConnectorRegistry, "register");
    expect(resolveConnectorName("some-name")).toBe("some-name");
    expect(registerSpy).not.toHaveBeenCalled();
    expect(ConnectorRegistry.has("some-name")).toBe(false);
  });

  it("auto-registers an IConnector instance and returns its name", () => {
    const connector = makeFakeConnector("resolve-a");
    expect(resolveConnectorName(connector)).toBe("resolve-a");
    expect(ConnectorRegistry.get("resolve-a")).toBe(connector);
  });

  it("is idempotent: an already-registered connector is not registered again", () => {
    const connector = makeFakeConnector("resolve-b");
    resolveConnectorName(connector);
    const registerSpy = vi.spyOn(ConnectorRegistry, "register");

    expect(resolveConnectorName(connector)).toBe("resolve-b");
    expect(registerSpy).not.toHaveBeenCalled();
  });
});
