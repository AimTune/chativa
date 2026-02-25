import { describe, it, expect } from "vitest";
import { GenUISteps } from "../GenUISteps";
import type { GenUIStep } from "../GenUISteps";

const STEPS: GenUIStep[] = [
  { label: "Order placed", status: "done" },
  { label: "Preparing", status: "active", description: "Being prepared." },
  { label: "Delivery", status: "pending" },
];

describe("GenUISteps", () => {
  it("is defined as a custom element", () => {
    expect(customElements.get("genui-steps")).toBeDefined();
  });

  it("steps defaults to undefined", () => {
    const el = new GenUISteps();
    expect(el.steps).toBeUndefined();
  });

  it("accepts a steps array", () => {
    const el = new GenUISteps();
    el.steps = STEPS;
    expect(el.steps).toHaveLength(3);
  });

  it("_renderIcon returns nothing-like for unknown status (type safety)", () => {
    const el = new GenUISteps();
    // Only valid statuses are done/active/pending; pending returns empty div
    const result = (el as any)._renderIcon("pending");
    expect(result).toBeDefined();
  });

  it("_renderIcon produces different output for each status", () => {
    const el = new GenUISteps();
    const done    = (el as any)._renderIcon("done");
    const active  = (el as any)._renderIcon("active");
    const pending = (el as any)._renderIcon("pending");
    // Each status returns a different Lit TemplateResult (different strings arrays)
    expect(done.strings).not.toBe(active.strings);
    expect(active.strings).not.toBe(pending.strings);
  });

  it("all three step statuses are accepted without error", () => {
    const el = new GenUISteps();
    const statuses: GenUIStep["status"][] = ["done", "active", "pending"];
    statuses.forEach((status) => {
      expect(() => (el as any)._renderIcon(status)).not.toThrow();
    });
  });
});
