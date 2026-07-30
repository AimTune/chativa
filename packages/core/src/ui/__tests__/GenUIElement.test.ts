import { describe, it, expect, vi, beforeAll } from "vitest";
import i18next from "i18next";
import { GenUIElement, GENUI_COMPONENT_EVENT } from "../GenUIElement";
import type { GenUIComponentEventDetail } from "../GenUIElement";

class TestWidget extends GenUIElement {}
customElements.define("test-genui-widget", TestWidget);

beforeAll(async () => {
  await i18next.init({
    lng: "en",
    resources: { en: { translation: { "test.hello": "Hello" } } },
  });
});

describe("GenUIElement", () => {
  it("dispatches a bubbling composed event from the default sendEvent", () => {
    const el = new TestWidget();
    document.body.appendChild(el);

    const spy = vi.fn();
    document.body.addEventListener(GENUI_COMPONENT_EVENT, spy as EventListener);
    el.sendEvent("refresh_weather", { city: "Istanbul" });

    expect(spy).toHaveBeenCalledTimes(1);
    const e = spy.mock.calls[0]![0] as CustomEvent<GenUIComponentEventDetail>;
    expect(e.detail).toEqual({ eventType: "refresh_weather", payload: { city: "Istanbul" } });
    expect(e.bubbles).toBe(true);
    expect(e.composed).toBe(true);

    document.body.removeEventListener(GENUI_COMPONENT_EVENT, spy as EventListener);
    el.remove();
  });

  it("an injected sendEvent shadows the default", () => {
    const el = new TestWidget();
    const injected = vi.fn();
    const dom = vi.fn();
    el.addEventListener(GENUI_COMPONENT_EVENT, dom as EventListener);

    // Mirrors what GenUIMessage does at mount time.
    (el as unknown as Record<string, unknown>)["sendEvent"] = injected;
    el.sendEvent("form_submit", { a: 1 });

    expect(injected).toHaveBeenCalledWith("form_submit", { a: 1 });
    expect(dom).not.toHaveBeenCalled();
  });

  it("default listenEvent + receiveEvent deliver payloads", () => {
    const el = new TestWidget();
    const cb = vi.fn();
    el.listenEvent("weather_updated", cb);
    el.receiveEvent("weather_updated", { temp: 21 });

    expect(cb).toHaveBeenCalledWith({ temp: 21 });
  });

  it("receiveEvent ignores unknown event types", () => {
    const el = new TestWidget();
    const cb = vi.fn();
    el.listenEvent("known", cb);
    el.receiveEvent("unknown", {});

    expect(cb).not.toHaveBeenCalled();
  });

  it("supports multiple listeners for the same type", () => {
    const el = new TestWidget();
    const a = vi.fn();
    const b = vi.fn();
    el.listenEvent("ping", a);
    el.listenEvent("ping", b);
    el.receiveEvent("ping");

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("clears local listeners on disconnect", () => {
    const el = new TestWidget();
    document.body.appendChild(el);
    const cb = vi.fn();
    el.listenEvent("ping", cb);
    el.remove();
    el.receiveEvent("ping");

    expect(cb).not.toHaveBeenCalled();
  });

  it("tFn translates a known key", () => {
    const el = new TestWidget();
    expect(el.tFn("test.hello")).toBe("Hello");
  });

  it("tFn falls back to the given fallback, then to the key", () => {
    const el = new TestWidget();
    expect(el.tFn("test.missing", "Fallback")).toBe("Fallback");
    expect(el.tFn("test.missing")).toBe("test.missing");
  });

  it("onLangChange subscribes and returns a working unsubscribe", () => {
    const el = new TestWidget();
    const cb = vi.fn();
    const unsub = el.onLangChange(cb);

    i18next.emit("languageChanged", "tr");
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
    i18next.emit("languageChanged", "en");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("inherits the ChativaElement i18n helper", () => {
    const el = new TestWidget();
    expect((el as unknown as { t(k: string): string }).t("test.hello")).toBe("Hello");
  });
});
