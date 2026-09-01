import { describe, it, expect, vi } from "vitest";
import { GenUIHtmlElement, sanitizeHtml } from "../GenUIHtmlElement";

/** Mount, set props, wait for Lit's update cycle. */
async function mount(props: Partial<GenUIHtmlElement> = {}, children = ""): Promise<GenUIHtmlElement> {
  const el = new GenUIHtmlElement();
  if (children) el.innerHTML = children;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const shadowHtml = (el: GenUIHtmlElement) => (el.shadowRoot?.innerHTML ?? "");

describe("sanitizeHtml", () => {
  it("drops script tags", () => {
    expect(sanitizeHtml("<div>ok</div><script>alert(1)</script>")).toBe("<div>ok</div>");
  });

  it("drops iframes and other document-loading tags", () => {
    const out = sanitizeHtml("<iframe src='https://evil.test'></iframe><object></object><p>keep</p>");
    expect(out).toBe("<p>keep</p>");
  });

  it("strips inline event handlers", () => {
    const out = sanitizeHtml(`<button onclick="alert(1)" onmouseover="x()">Go</button>`);
    expect(out).toBe("<button>Go</button>");
  });

  it("strips javascript: URLs but keeps safe ones", () => {
    expect(sanitizeHtml(`<a href="javascript:alert(1)">x</a>`)).toBe("<a>x</a>");
    expect(sanitizeHtml(`<a href="vbscript:msgbox">x</a>`)).toBe("<a>x</a>");
    expect(sanitizeHtml(`<a href="https://ok.test">x</a>`)).toContain(`href="https://ok.test"`);
    expect(sanitizeHtml(`<a href="mailto:a@b.c">x</a>`)).toContain(`href="mailto:a@b.c"`);
  });

  it("sees through whitespace/control-char obfuscation of javascript:", () => {
    expect(sanitizeHtml(`<a href="java\tscript:alert(1)">x</a>`)).toBe("<a>x</a>");
    expect(sanitizeHtml(`<a href="  JaVaScRiPt:alert(1)">x</a>`)).toBe("<a>x</a>");
  });

  it("keeps relative URLs", () => {
    expect(sanitizeHtml(`<img src="images/a.png">`)).toContain(`src="images/a.png"`);
    expect(sanitizeHtml(`<a href="/local">x</a>`)).toContain(`href="/local"`);
    expect(sanitizeHtml(`<a href="../up">x</a>`)).toContain(`href="../up"`);
    expect(sanitizeHtml(`<a href="#anchor">x</a>`)).toContain(`href="#anchor"`);
    expect(sanitizeHtml(`<img srcset="a.png 1x, b.png 2x">`)).toContain(`srcset="a.png 1x, b.png 2x"`);
  });

  it("allows data: URLs for images only", () => {
    expect(sanitizeHtml(`<img src="data:image/png;base64,AAA">`)).toContain("data:image/png");
    expect(sanitizeHtml(`<a href="data:text/html,<script>1</script>">x</a>`)).not.toContain("data:text/html");
  });

  it("keeps structure, classes and inline styles", () => {
    const markup = `<div class="card" style="color: red"><h3>Title</h3></div>`;
    expect(sanitizeHtml(markup)).toBe(markup);
  });

  it("keeps data-event / data-payload hooks intact", () => {
    const markup = `<button data-event="track" data-payload="{&quot;id&quot;:1}">Track</button>`;
    expect(sanitizeHtml(markup)).toContain(`data-event="track"`);
  });
});

describe("GenUIHtmlElement", () => {
  it("is defined as <chativa-html>", () => {
    expect(customElements.get("chativa-html")).toBe(GenUIHtmlElement);
  });

  it("renders sanitized markup from the html prop", async () => {
    const el = await mount({ html: `<p class="x">hi</p><script>alert(1)</script>` });
    expect(shadowHtml(el)).toContain(`<p class="x">hi</p>`);
    expect(shadowHtml(el)).not.toContain("script");
  });

  it("renders markup verbatim when unsafe is set", async () => {
    const el = await mount({ html: `<b onclick="x()">hi</b>`, unsafe: true });
    expect(shadowHtml(el)).toContain("onclick");
  });

  it("injects the css prop into the shadow root", async () => {
    const el = await mount({ html: "<p>hi</p>", css: ".x { color: red; }" });
    const style = el.shadowRoot!.querySelector("style");
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain(".x { color: red; }");
  });

  it("falls back to a slot when no html prop is set", async () => {
    const el = await mount({}, "<b>child</b>");
    expect(shadowHtml(el)).toContain("<slot>");
  });

  it("re-renders when the backend streams new markup", async () => {
    const el = await mount({ html: "<p>first</p>" });
    el.html = "<p>second</p>";
    await el.updateComplete;
    expect(shadowHtml(el)).toContain("second");
    expect(shadowHtml(el)).not.toContain("first");
  });

  it("sends data-event clicks through sendEvent", async () => {
    const el = await mount({ html: `<button data-event="track_order" data-payload='{"id":123}'>Track</button>` });
    const sent = vi.fn();
    (el as unknown as Record<string, unknown>)["sendEvent"] = sent;

    el.shadowRoot!.querySelector("button")!.click();

    expect(sent).toHaveBeenCalledWith("track_order", { id: 123 });
  });

  it("finds the data-event ancestor when an inner node is clicked", async () => {
    const el = await mount({ html: `<div data-event="card_click"><span>inner</span></div>` });
    const sent = vi.fn();
    (el as unknown as Record<string, unknown>)["sendEvent"] = sent;

    el.shadowRoot!.querySelector("span")!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));

    expect(sent).toHaveBeenCalledWith("card_click", {});
  });

  it("passes a non-JSON data-payload through as a raw string", async () => {
    const el = await mount({ html: `<button data-event="pick" data-payload="blue">Blue</button>` });
    const sent = vi.fn();
    (el as unknown as Record<string, unknown>)["sendEvent"] = sent;

    el.shadowRoot!.querySelector("button")!.click();

    expect(sent).toHaveBeenCalledWith("pick", "blue");
  });

  it("ignores clicks on elements without data-event", async () => {
    const el = await mount({ html: `<button>plain</button>` });
    const sent = vi.fn();
    (el as unknown as Record<string, unknown>)["sendEvent"] = sent;

    el.shadowRoot!.querySelector("button")!.click();

    expect(sent).not.toHaveBeenCalled();
  });

  it("submits form fields merged over data-payload", async () => {
    const el = await mount({
      html: `<form data-event="lead_form" data-payload='{"source":"chat","name":"default"}'>
               <input name="name" value="Hamza" />
               <input name="email" value="a@b.c" />
             </form>`,
    });
    const sent = vi.fn();
    (el as unknown as Record<string, unknown>)["sendEvent"] = sent;

    const form = el.shadowRoot!.querySelector("form")!;
    const evt = new Event("submit", { bubbles: true, cancelable: true, composed: true });
    form.dispatchEvent(evt);

    expect(evt.defaultPrevented).toBe(true);
    expect(sent).toHaveBeenCalledWith("lead_form", { source: "chat", name: "Hamza", email: "a@b.c" });
  });

  it("emits the fallback DOM event when no host injected sendEvent", async () => {
    const el = await mount({ html: `<button data-event="say_hi">Hi</button>` });
    const spy = vi.fn();
    document.body.addEventListener("genui-component-event", spy as EventListener);

    el.shadowRoot!.querySelector("button")!.click();

    expect(spy).toHaveBeenCalledOnce();
    const e = spy.mock.calls[0]![0] as CustomEvent;
    expect(e.detail).toEqual({ eventType: "say_hi", payload: {} });

    document.body.removeEventListener("genui-component-event", spy as EventListener);
  });

  // ── event scope: who the interaction is addressed to ──────────────────────

  describe("event scope", () => {
    /** Click the only button and return the args `sendEvent` was called with. */
    async function clickWith(markup: string): Promise<unknown[]> {
      const el = await mount({ html: markup });
      const sent = vi.fn();
      (el as unknown as Record<string, unknown>)["sendEvent"] = sent;
      el.shadowRoot!.querySelector("button")!.click();
      return sent.mock.calls[0] ?? [];
    }

    it("sends scope 'component' for a component-event attribute", async () => {
      expect(await clickWith(`<button component-event="rate_delivery" data-payload='{"stars":5}'>Rate</button>`))
        .toEqual(["rate_delivery", { stars: 5 }, { scope: "component" }]);
    });

    it("sends scope 'graph' for a mekik-event attribute", async () => {
      expect(await clickWith(`<button mekik-event="track_order" data-payload='{"id":"ORD-42"}'>Track</button>`))
        .toEqual(["track_order", { id: "ORD-42" }, { scope: "graph" }]);
    });

    it("sends no scope for a plain data-event — the backend decides", async () => {
      expect(await clickWith(`<button data-event="track_order">Track</button>`))
        .toEqual(["track_order", {}]);
    });

    it("prefers the most specific attribute when an element carries several", async () => {
      expect(await clickWith(`<button component-event="mine" mekik-event="theirs" data-event="legacy">Go</button>`))
        .toEqual(["mine", {}, { scope: "component" }]);
    });

    it("treats an empty event name as no trigger at all", async () => {
      expect(await clickWith(`<button component-event="">Go</button>`)).toEqual([]);
    });

    it("carries the scope through a form submit too", async () => {
      const el = await mount({
        html: `<form component-event="rate_delivery"><input name="stars" value="5" /></form>`,
      });
      const sent = vi.fn();
      (el as unknown as Record<string, unknown>)["sendEvent"] = sent;

      const form = el.shadowRoot!.querySelector("form")!;
      const evt = new Event("submit", { bubbles: true, cancelable: true, composed: true });
      form.dispatchEvent(evt);

      expect(evt.defaultPrevented).toBe(true);
      expect(sent).toHaveBeenCalledWith("rate_delivery", { stars: "5" }, { scope: "component" });
    });

    it("puts the scope on the fallback DOM event's detail", async () => {
      const el = await mount({ html: `<button mekik-event="track_order">Track</button>` });
      const spy = vi.fn();
      document.body.addEventListener("genui-component-event", spy as EventListener);

      el.shadowRoot!.querySelector("button")!.click();

      const e = spy.mock.calls[0]![0] as CustomEvent;
      expect(e.detail).toEqual({ eventType: "track_order", payload: {}, scope: "graph" });

      document.body.removeEventListener("genui-component-event", spy as EventListener);
    });
  });
});
