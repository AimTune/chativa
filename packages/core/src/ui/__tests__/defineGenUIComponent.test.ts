import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GenUIComponentDefinition } from "../../domain/entities/GenUI";
import { defineGenUIComponent, clearDefinedGenUIComponents } from "../defineGenUIComponent";
import { GenUIHtmlElement } from "../GenUIHtmlElement";

const ORDER_CARD: GenUIComponentDefinition = {
  name: "order-card",
  template: `<div class="card"><h3>{{title}}</h3>
    {{#each lines}}<p>{{this.label}}</p>{{/each}}
    <button data-event="track_order" data-payload='{"id":"{{id}}"}'>Track</button></div>`,
  css: ".card { padding: 12px; }",
  props: { id: "", title: "", lines: [] },
};

async function mount(Ctor: typeof GenUIHtmlElement, props: Record<string, unknown> = {}) {
  const el = new Ctor();
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

beforeEach(() => clearDefinedGenUIComponents());

describe("defineGenUIComponent", () => {
  it("renders the template against the props", async () => {
    const el = await mount(defineGenUIComponent(ORDER_CARD), {
      id: "A1",
      title: "Order #123",
      lines: [{ label: "Tea" }, { label: "Cake" }],
    });

    const shadow = el.shadowRoot!.innerHTML;
    expect(shadow).toContain("Order #123");
    expect(shadow).toContain("<p>Tea</p>");
    expect(shadow).toContain("<p>Cake</p>");
    el.remove();
  });

  it("applies the definition's css and defaults", async () => {
    const el = await mount(defineGenUIComponent({
      name: "greet",
      template: "<p>{{greeting}}</p>",
      css: "p { color: red; }",
      props: { greeting: "Merhaba" },
    }));

    expect(el.shadowRoot!.querySelector("style")!.textContent).toContain("color: red");
    expect(el.shadowRoot!.innerHTML).toContain("Merhaba");
    el.remove();
  });

  it("re-renders in place when a declared prop changes", async () => {
    const Ctor = defineGenUIComponent({
      name: "counter",
      template: "<p>{{count}}</p>",
      props: { count: 0 },
    });
    const el = await mount(Ctor, { count: 1 });
    expect(el.shadowRoot!.innerHTML).toContain("<p>1</p>");

    (el as unknown as Record<string, unknown>)["count"] = 2;
    await el.updateComplete;
    expect(el.shadowRoot!.innerHTML).toContain("<p>2</p>");
    el.remove();
  });

  it("keeps object defaults per-instance instead of aliasing them", async () => {
    const Ctor = defineGenUIComponent({
      name: "listy",
      template: "{{#each items}}x{{/each}}",
      props: { items: [] },
    });
    const a = new Ctor() as unknown as Record<string, unknown>;
    const b = new Ctor() as unknown as Record<string, unknown>;
    (a["items"] as unknown[]).push(1);

    expect(a["items"]).toHaveLength(1);
    expect(b["items"]).toHaveLength(0);
  });

  it("sanitizes template output — a definition cannot ship a script", async () => {
    const el = await mount(defineGenUIComponent({
      name: "sneaky",
      template: `<p>ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>`,
    }));

    expect(el.shadowRoot!.innerHTML).toContain("<p>ok</p>");
    expect(el.shadowRoot!.innerHTML).not.toContain("script>");
    expect(el.shadowRoot!.querySelector("a")!.hasAttribute("href")).toBe(false);
    el.remove();
  });

  it("escapes prop values, so props cannot inject markup either", async () => {
    const el = await mount(defineGenUIComponent({
      name: "escapey",
      template: "<p>{{text}}</p>",
      props: { text: "" },
    }), { text: "<img src=x onerror=alert(1)>" });

    expect(el.shadowRoot!.querySelector("img")).toBeNull();
    expect(el.shadowRoot!.innerHTML).toContain("&lt;img");
    el.remove();
  });

  it("routes data-event clicks like any other GenUI component", async () => {
    const el = await mount(defineGenUIComponent(ORDER_CARD), { id: "A1" });
    const sent = vi.fn();
    (el as unknown as Record<string, unknown>)["sendEvent"] = sent;

    el.shadowRoot!.querySelector("button")!.click();

    expect(sent).toHaveBeenCalledWith("track_order", { id: "A1" });
    el.remove();
  });

  it("returns the same class for the same name@version", () => {
    expect(defineGenUIComponent(ORDER_CARD)).toBe(defineGenUIComponent({ ...ORDER_CARD }));
  });

  it("builds a new class when the version changes", () => {
    const v1 = defineGenUIComponent({ ...ORDER_CARD, version: "1" });
    const v2 = defineGenUIComponent({ ...ORDER_CARD, version: "2" });
    expect(v2).not.toBe(v1);
  });

  it("defines a distinct custom element tag per definition", () => {
    defineGenUIComponent({ name: "tagged", template: "<p>1</p>" });
    expect(customElements.get("chativa-genui-tagged")).toBeDefined();

    clearDefinedGenUIComponents();
    defineGenUIComponent({ name: "tagged", template: "<p>2</p>", version: "2" });
    // The first tag is taken, so the second definition gets its own.
    expect(customElements.get("chativa-genui-tagged-1")).toBeDefined();
  });

  it("honours an explicit tag", () => {
    defineGenUIComponent({ name: "custom-tag", template: "<p>x</p>", tag: "my-server-widget" });
    expect(customElements.get("my-server-widget")).toBeDefined();
  });

  it("refuses to let a definition prop take over html/css/unsafe", async () => {
    const el = await mount(defineGenUIComponent({
      name: "hijack",
      template: "<p>safe</p>",
      props: { unsafe: true, html: "<script>alert(1)</script>" },
    }));

    expect(el.unsafe).toBe(false);
    expect(el.shadowRoot!.innerHTML).not.toContain("script>");
    el.remove();
  });

  it("exposes the source definition on the class", () => {
    const Ctor = defineGenUIComponent(ORDER_CARD) as unknown as { definition: GenUIComponentDefinition };
    expect(Ctor.definition.name).toBe("order-card");
  });
});
