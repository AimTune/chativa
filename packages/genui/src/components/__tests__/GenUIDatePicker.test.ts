import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

describe("GenUIDatePicker (mounted)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  async function mount(props: Partial<GenUIDatePicker> = {}) {
    const el = new GenUIDatePicker();
    Object.assign(el, props);
    document.body.appendChild(el);
    await el.updateComplete;
    return { el, input: el.shadowRoot!.querySelector("input")!, label: el.shadowRoot!.querySelector("label")! };
  }

  it("renders a native date input reflecting value, min, max and disabled", async () => {
    const { input, label } = await mount({
      label: "Appointment date",
      min: "2025-01-01",
      max: "2025-12-31",
      value: "2025-06-15",
      disabled: true,
    });
    expect(label.textContent).toBe("Appointment date");
    expect(input.type).toBe("date");
    expect(input.value).toBe("2025-06-15");
    expect(input.getAttribute("min")).toBe("2025-01-01");
    expect(input.getAttribute("max")).toBe("2025-12-31");
    expect(input.disabled).toBe(true);
  });

  it("omits min/max attributes when not set", async () => {
    const { input } = await mount();
    expect(input.hasAttribute("min")).toBe(false);
    expect(input.hasAttribute("max")).toBe(false);
    expect(input.value).toBe("");
  });

  it("emits date_select when the user picks a date", async () => {
    const sendEvent = vi.fn();
    const { el, input } = await mount({ sendEvent });

    input.value = "2025-03-04";
    input.dispatchEvent(new Event("change"));

    expect(sendEvent).toHaveBeenCalledWith("date_select", { date: "2025-03-04" });
    expect(el.value).toBe("2025-03-04");
  });
});
