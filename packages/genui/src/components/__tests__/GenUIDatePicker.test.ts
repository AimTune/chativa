import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenUIDatePicker } from "../GenUIDatePicker";

describe("GenUIDatePicker", () => {
  let el: GenUIDatePicker;

  beforeEach(() => {
    el = new GenUIDatePicker();
  });

  it("is defined as a custom element", () => {
    expect(customElements.get("genui-date-picker")).toBeDefined();
  });

  it("disabled defaults to false", () => {
    expect(el.disabled).toBe(false);
  });

  it("value defaults to undefined", () => {
    expect(el.value).toBeUndefined();
  });

  it("label defaults to undefined (uses i18n fallback)", () => {
    expect(el.label).toBeUndefined();
  });

  it("does not throw when sendEvent is not injected and _onChange fires", () => {
    el.sendEvent = undefined;
    const fakeEvent = { target: { value: "2025-06-15" } } as unknown as Event;
    expect(() => (el as any)._onChange(fakeEvent)).not.toThrow();
  });

  it("calls sendEvent('date_select', { date }) when _onChange fires", () => {
    const handler = vi.fn();
    el.sendEvent = handler;
    const fakeEvent = { target: { value: "2025-06-15" } } as unknown as Event;
    (el as any)._onChange(fakeEvent);
    expect(handler).toHaveBeenCalledWith("date_select", { date: "2025-06-15" });
  });

  it("updates value property when _onChange fires", () => {
    el.sendEvent = vi.fn();
    const fakeEvent = { target: { value: "2025-12-01" } } as unknown as Event;
    (el as any)._onChange(fakeEvent);
    expect(el.value).toBe("2025-12-01");
  });

  it("min, max props are assignable", () => {
    el.min = "2025-01-01";
    el.max = "2025-12-31";
    expect(el.min).toBe("2025-01-01");
    expect(el.max).toBe("2025-12-31");
  });
});
