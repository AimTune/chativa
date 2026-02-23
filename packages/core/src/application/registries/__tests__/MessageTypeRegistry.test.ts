import { describe, it, expect, beforeEach } from "vitest";
import { MessageTypeRegistry } from "../MessageTypeRegistry";

const MockComponent = class extends HTMLElement {} as typeof HTMLElement;
const FallbackComponent = class extends HTMLElement {} as typeof HTMLElement;

describe("MessageTypeRegistry", () => {
  beforeEach(() => MessageTypeRegistry.clear());

  it("registers and resolves a component", () => {
    MessageTypeRegistry.register("text", MockComponent);
    expect(MessageTypeRegistry.resolve("text")).toBe(MockComponent);
  });

  it("has() returns true after registration", () => {
    MessageTypeRegistry.register("card", MockComponent);
    expect(MessageTypeRegistry.has("card")).toBe(true);
  });

  it("has() returns false for unregistered type", () => {
    expect(MessageTypeRegistry.has("unknown")).toBe(false);
  });

  it("resolve falls back to registered fallback", () => {
    MessageTypeRegistry.setFallback(FallbackComponent);
    expect(MessageTypeRegistry.resolve("any-type")).toBe(FallbackComponent);
  });

  it("throws when resolving unknown type with no fallback", () => {
    expect(() => MessageTypeRegistry.resolve("ghost")).toThrow(/no component/);
  });

  it("unregister removes the type", () => {
    MessageTypeRegistry.register("img", MockComponent);
    MessageTypeRegistry.unregister("img");
    expect(MessageTypeRegistry.has("img")).toBe(false);
  });

  it("list() returns all registered type names", () => {
    MessageTypeRegistry.register("a", MockComponent);
    MessageTypeRegistry.register("b", MockComponent);
    expect(MessageTypeRegistry.list()).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("overwrites a type silently on re-register (Map behavior)", () => {
    MessageTypeRegistry.register("text", MockComponent);
    const Other = class extends HTMLElement {} as typeof HTMLElement;
    MessageTypeRegistry.register("text", Other);
    expect(MessageTypeRegistry.resolve("text")).toBe(Other);
  });
});
