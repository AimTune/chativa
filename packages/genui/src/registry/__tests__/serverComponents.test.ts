import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { genUIDefinitionStore, clearDefinedGenUIComponents, type GenUIComponentDefinition } from "@chativa/core";
import { GenUIRegistry } from "../GenUIRegistry";
import {
  registerServerComponent,
  subscribeServerComponents,
  clearServerComponents,
  setServerComponentPolicy,
  getServerComponentPolicy,
} from "../serverComponents";
import "../../index";

const CARD: GenUIComponentDefinition = {
  name: "order-card",
  template: `<div><h3>{{title}}</h3><button data-event="track">Track</button></div>`,
  props: { title: "" },
};

beforeEach(() => {
  clearServerComponents();
  clearDefinedGenUIComponents();
  genUIDefinitionStore.clear();
});

afterEach(() => vi.restoreAllMocks());

describe("registerServerComponent", () => {
  it("registers a definition under its name", () => {
    expect(registerServerComponent(CARD)).toBe(true);
    expect(GenUIRegistry.has("order-card")).toBe(true);
  });

  it("produces a constructible element that renders the template", async () => {
    registerServerComponent(CARD);
    const Ctor = GenUIRegistry.resolve("order-card")!.component;

    const el = new Ctor() as HTMLElement & { title: string; updateComplete: Promise<boolean> };
    el.title = "Order #7";
    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.innerHTML).toContain("Order #7");
    el.remove();
  });

  it("rejects a definition without a name or template", () => {
    expect(registerServerComponent({ name: "", template: "<p>x</p>" })).toBe(false);
    expect(registerServerComponent({ name: "x" } as GenUIComponentDefinition)).toBe(false);
  });

  it("refuses to overwrite a built-in", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const before = GenUIRegistry.resolve("genui-form")!.component;

    expect(registerServerComponent({ name: "genui-form", template: "<p>hijacked</p>" })).toBe(false);
    expect(GenUIRegistry.resolve("genui-form")!.component).toBe(before);
    expect(warn).toHaveBeenCalled();
  });

  it("lets the server replace a component it defined itself", () => {
    registerServerComponent(CARD);
    const first = GenUIRegistry.resolve("order-card")!.component;

    expect(registerServerComponent({ ...CARD, version: "2", template: "<p>v2</p>" })).toBe(true);
    expect(GenUIRegistry.resolve("order-card")!.component).not.toBe(first);
  });
});

describe("subscribeServerComponents", () => {
  it("registers definitions published to the store", () => {
    const unsub = subscribeServerComponents();
    genUIDefinitionStore.publish([CARD]);

    expect(GenUIRegistry.has("order-card")).toBe(true);
    unsub();
  });

  it("picks up definitions published before it subscribed", () => {
    genUIDefinitionStore.publish([CARD]);
    const unsub = subscribeServerComponents();

    expect(GenUIRegistry.has("order-card")).toBe(true);
    unsub();
  });

  it("stops registering after unsubscribe", () => {
    subscribeServerComponents()();
    genUIDefinitionStore.publish([CARD]);

    expect(GenUIRegistry.has("order-card")).toBe(false);
  });
});

describe("name collisions with a locally registered component", () => {
  /** What the sandbox does: register a component under a name the server also uses. */
  const registerLocal = (name: string) =>
    GenUIRegistry.register(name, class extends HTMLElement {} as unknown as typeof HTMLElement);

  it("defaults to app-wins", () => {
    expect(getServerComponentPolicy()).toBe("app-wins");
  });

  it("keeps the local component and says why", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    registerLocal("order-card");
    const local = GenUIRegistry.resolve("order-card")!.component;

    expect(registerServerComponent({ ...CARD, name: "order-card" })).toBe(false);
    expect(GenUIRegistry.resolve("order-card")!.component).toBe(local);
    // The blank-widget failure mode is only debuggable if the warning names the
    // component and the way out.
    const message = String(warn.mock.calls[0]![0]);
    expect(message).toContain("order-card");
    expect(message).toContain("server-wins");

    GenUIRegistry.unregister("order-card");
  });

  it("lets the server win when the policy says so", () => {
    registerLocal("order-card");
    const local = GenUIRegistry.resolve("order-card")!.component;
    setServerComponentPolicy("server-wins");

    expect(registerServerComponent({ ...CARD, name: "order-card" })).toBe(true);
    expect(GenUIRegistry.resolve("order-card")!.component).not.toBe(local);

    GenUIRegistry.unregister("order-card");
  });

  it("still refuses to clobber a built-in under app-wins", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const before = GenUIRegistry.resolve("genui-form")!.component;

    expect(registerServerComponent({ name: "genui-form", template: "<p>x</p>" })).toBe(false);
    expect(GenUIRegistry.resolve("genui-form")!.component).toBe(before);
  });

  it("clearServerComponents resets the policy", () => {
    setServerComponentPolicy("server-wins");
    clearServerComponents();
    expect(getServerComponentPolicy()).toBe("app-wins");
  });
});
