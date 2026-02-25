import { describe, it, expect } from "vitest";
import { GenUIChart } from "../GenUIChart";
import type { GenUIDataset } from "../GenUIChart";

const DATASETS: GenUIDataset[] = [
  { label: "Revenue", data: [100, 200, 150], color: "#4f46e5" },
  { label: "Costs",   data: [80,  120, 90] },
];

describe("GenUIChart", () => {
  it("is defined as a custom element", () => {
    expect(customElements.get("genui-chart")).toBeDefined();
  });

  it("type defaults to 'bar'", () => {
    const el = new GenUIChart();
    expect(el.type).toBe("bar");
  });

  it("accepts all three type values", () => {
    const el = new GenUIChart();
    (["bar", "line", "pie"] as const).forEach((t) => {
      el.type = t;
      expect(el.type).toBe(t);
    });
  });

  it("_color returns palette color when no override", () => {
    const el = new GenUIChart();
    const color = (el as any)._color(0);
    expect(color).toMatch(/^#/);
  });

  it("_color returns override color when provided", () => {
    const el = new GenUIChart();
    expect((el as any)._color(0, "#ff0000")).toBe("#ff0000");
  });

  it("_color wraps around palette for index >= palette length", () => {
    const el = new GenUIChart();
    const c0 = (el as any)._color(0);
    const c6 = (el as any)._color(6); // palette has 6 entries
    expect(c6).toBe(c0);
  });

  it("_renderBar does not throw with empty datasets", () => {
    const el = new GenUIChart();
    el.datasets = [];
    expect(() => (el as any)._renderBar()).not.toThrow();
  });

  it("_renderBar does not throw with valid datasets", () => {
    const el = new GenUIChart();
    el.datasets = DATASETS;
    el.labels = ["Jan", "Feb", "Mar"];
    expect(() => (el as any)._renderBar()).not.toThrow();
  });

  it("_renderLine returns nothing-like when datasets empty", () => {
    const el = new GenUIChart();
    el.datasets = [];
    const result = (el as any)._renderLine();
    // Lit's `nothing` is a symbol; result should be falsy or a Lit nothing value
    expect(result == null || result === "" || typeof result === "symbol").toBe(true);
  });

  it("_renderLine does not throw with valid datasets", () => {
    const el = new GenUIChart();
    el.datasets = DATASETS;
    el.labels = ["Jan", "Feb", "Mar"];
    expect(() => (el as any)._renderLine()).not.toThrow();
  });

  it("_renderPie returns nothing-like when datasets empty", () => {
    const el = new GenUIChart();
    el.datasets = [];
    const result = (el as any)._renderPie();
    expect(result == null || result === "" || typeof result === "symbol").toBe(true);
  });

  it("_renderPie does not throw with valid datasets", () => {
    const el = new GenUIChart();
    el.datasets = [{ label: "A", data: [60] }, { label: "B", data: [40] }];
    expect(() => (el as any)._renderPie()).not.toThrow();
  });

  it("_renderLegend returns nothing-like when no dataset has a label", () => {
    const el = new GenUIChart();
    el.datasets = [{ data: [1, 2, 3] }];
    const result = (el as any)._renderLegend();
    expect(result == null || result === "" || typeof result === "symbol").toBe(true);
  });

  it("title prop is assignable", () => {
    const el = new GenUIChart();
    el.title = "Monthly Sales";
    expect(el.title).toBe("Monthly Sales");
  });
});
