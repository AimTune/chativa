import { describe, it, expect, beforeEach } from "vitest";
import { GenUIRegistry } from "../GenUIRegistry";

class WidgetA extends HTMLElement {}
class WidgetB extends HTMLElement {}

describe("GenUIRegistry", () => {
  beforeEach(() => {
    GenUIRegistry.clear();
  });

  it("registers and resolves a component", () => {
    GenUIRegistry.register("a", WidgetA);
    expect(GenUIRegistry.has("a")).toBe(true);
    expect(GenUIRegistry.resolve("a")).toEqual({ component: WidgetA, schema: undefined });
  });

  it("stores an optional schema alongside the component", () => {
    const schema = { safeParse: () => ({ success: true }) };
    GenUIRegistry.register("a", WidgetA, { schema });
    expect(GenUIRegistry.resolve("a")?.schema).toBe(schema);
  });

  it("returns undefined / false for unknown names", () => {
    expect(GenUIRegistry.resolve("missing")).toBeUndefined();
    expect(GenUIRegistry.has("missing")).toBe(false);
  });

  it("overwrites an existing registration with the same name", () => {
    GenUIRegistry.register("a", WidgetA);
    GenUIRegistry.register("a", WidgetB);
    expect(GenUIRegistry.resolve("a")?.component).toBe(WidgetB);
  });

  it("lists, unregisters and clears registrations", () => {
    GenUIRegistry.register("a", WidgetA);
    GenUIRegistry.register("b", WidgetB);
    expect(GenUIRegistry.list()).toEqual(["a", "b"]);

    GenUIRegistry.unregister("a");
    expect(GenUIRegistry.list()).toEqual(["b"]);

    GenUIRegistry.clear();
    expect(GenUIRegistry.list()).toEqual([]);
  });
});
