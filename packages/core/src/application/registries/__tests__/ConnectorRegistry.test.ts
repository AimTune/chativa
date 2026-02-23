import { describe, it, expect, beforeEach } from "vitest";
import { ConnectorRegistry } from "../ConnectorRegistry";
import type { IConnector } from "../../../domain/ports/IConnector";

function makeMockConnector(name: string): IConnector {
  return {
    name,
    connect: async () => {},
    disconnect: async () => {},
    sendMessage: async () => {},
    onMessage: () => {},
  };
}

describe("ConnectorRegistry", () => {
  beforeEach(() => ConnectorRegistry.clear());

  it("registers and retrieves a connector by name", () => {
    const c = makeMockConnector("test");
    ConnectorRegistry.register(c);
    expect(ConnectorRegistry.get("test")).toBe(c);
  });

  it("throws when registering the same name twice", () => {
    ConnectorRegistry.register(makeMockConnector("dup"));
    expect(() => ConnectorRegistry.register(makeMockConnector("dup"))).toThrow(
      /already registered/
    );
  });

  it("throws when getting an unregistered connector", () => {
    expect(() => ConnectorRegistry.get("missing")).toThrow(/not found/);
  });

  it("has() returns true for registered connector", () => {
    ConnectorRegistry.register(makeMockConnector("x"));
    expect(ConnectorRegistry.has("x")).toBe(true);
  });

  it("has() returns false for unknown name", () => {
    expect(ConnectorRegistry.has("nope")).toBe(false);
  });

  it("unregister removes the connector", () => {
    ConnectorRegistry.register(makeMockConnector("rm"));
    ConnectorRegistry.unregister("rm");
    expect(ConnectorRegistry.has("rm")).toBe(false);
  });

  it("list() returns all registered names", () => {
    ConnectorRegistry.register(makeMockConnector("a"));
    ConnectorRegistry.register(makeMockConnector("b"));
    expect(ConnectorRegistry.list()).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("clear() removes all connectors", () => {
    ConnectorRegistry.register(makeMockConnector("z"));
    ConnectorRegistry.clear();
    expect(ConnectorRegistry.list()).toHaveLength(0);
  });

  it("allows re-registration after unregister", () => {
    const c = makeMockConnector("reuse");
    ConnectorRegistry.register(c);
    ConnectorRegistry.unregister("reuse");
    expect(() => ConnectorRegistry.register(c)).not.toThrow();
  });
});
