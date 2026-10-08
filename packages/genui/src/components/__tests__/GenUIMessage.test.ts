import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { LitElement, html } from "lit";
import {
  chatStore,
  i18next,
  MessageTypeRegistry,
  type AIChunk,
  type GenUIStreamState,
} from "@chativa/core";
import { GenUIMessage } from "../GenUIMessage";
import { GenUIForm } from "../GenUIForm";
import { GenUIRegistry } from "../../registry/GenUIRegistry";

// ── Test doubles ──────────────────────────────────────────────────────────────

/** A probe component that exposes the API GenUIMessage injects into it. */
class ProbeWidget extends LitElement {
  label = "";
  sendEvent?: (type: string, payload: unknown, opts?: Record<string, unknown>) => void;
  listenEvent?: (type: string, cb: (payload: unknown) => void) => void;
  tFn?: (key: string, fallback?: string) => string;
  onLangChange?: (cb: () => void) => () => void;
  override render() {
    return html`<span class="probe">${this.label}</span>`;
  }
}
customElements.define("test-probe-widget", ProbeWidget);

class OtherWidget extends LitElement {}
customElements.define("test-other-widget", OtherWidget);

GenUIRegistry.register("probe", ProbeWidget);
GenUIRegistry.register("other", OtherWidget);
GenUIRegistry.register("genui-form", GenUIForm as unknown as typeof HTMLElement);

// ── Helpers ──────────────────────────────────────────────────────────────────

type Chunk = AIChunk;

function state(chunks: Chunk[], streamingComplete = false): GenUIStreamState {
  return { chunks, streamingComplete };
}

async function mount(data: GenUIStreamState, props: Partial<GenUIMessage> = {}) {
  const el = new GenUIMessage();
  el.messageId = "msg-1";
  el.messageData = data as unknown as Record<string, unknown>;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

async function stream(el: GenUIMessage, data: GenUIStreamState) {
  el.messageData = data as unknown as Record<string, unknown>;
  await el.updateComplete;
}

const root = (el: GenUIMessage) => el.shadowRoot!;
const probe = (el: GenUIMessage) => root(el).querySelector("test-probe-widget") as ProbeWidget;
const typingDots = (el: GenUIMessage) => root(el).querySelector(".typing-dots");

beforeAll(async () => {
  await i18next.init({ lng: "en", resources: { en: { translation: { "greet": "Hello" } } } });
});

afterEach(() => {
  document.body.innerHTML = "";
  chatStore.getState().setTheme({ avatar: { bot: undefined, showBot: true } });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GenUIMessage", () => {
  it("is registered as the 'genui' message type", () => {
    expect(customElements.get("genui-message")).toBe(GenUIMessage);
    expect(MessageTypeRegistry.resolve("genui")).toBe(GenUIMessage);
  });

  describe("streaming text", () => {
    it("renders text chunks as bubbles and shows typing dots while streaming", async () => {
      const el = await mount(state([
        { type: "text", content: "Hello", id: 1 },
        { type: "text", content: "world", id: 2 },
      ]));

      const bubbles = Array.from(root(el).querySelectorAll(".chativa-bubble")).map((b) => b.textContent);
      expect(bubbles).toEqual(["Hello", "world"]);
      expect(typingDots(el)).not.toBeNull();
    });

    it("shows typing dots before the first chunk arrives (empty or missing data)", async () => {
      const el = await mount(state([]));
      expect(typingDots(el)).not.toBeNull();

      el.messageData = {};
      await el.updateComplete;
      expect(typingDots(el)).not.toBeNull();
    });

    it("hides typing dots once streaming completes", async () => {
      const el = await mount(state([{ type: "text", content: "Hi", id: 1 }]));
      await stream(el, state([{ type: "text", content: "Hi", id: 1 }], true));
      expect(typingDots(el)).toBeNull();
    });

    it("hides typing dots while the last chunk is a UI component awaiting input", async () => {
      const el = await mount(state([
        { type: "text", content: "Fill this in:", id: 1 },
        { type: "ui", component: "probe", props: {}, id: 2 },
      ]));
      expect(typingDots(el)).toBeNull();
    });
  });

  describe("UI chunks", () => {
    it("mounts the registered component and assigns its props", async () => {
      const el = await mount(state([{ type: "ui", component: "probe", props: { label: "hi" }, id: 1 }]));
      const w = probe(el);
      expect(w).toBeInstanceOf(ProbeWidget);
      expect(w.label).toBe("hi");
      await w.updateComplete;
      expect(w.shadowRoot!.querySelector(".probe")?.textContent).toBe("hi");
    });

    it("reuses the same instance across stream updates and syncs new props", async () => {
      const el = await mount(state([{ type: "ui", component: "probe", props: { label: "one" }, id: 7 }]));
      const first = probe(el);

      await stream(el, state([{ type: "ui", component: "probe", props: { label: "two" }, id: 7 }]));

      expect(probe(el)).toBe(first);
      expect(first.label).toBe("two");
    });

    it("rebuilds the element when a chunk id is reused for a different component", async () => {
      const el = await mount(state([{ type: "ui", component: "probe", props: {}, id: 3 }]));
      expect(probe(el)).not.toBeNull();

      await stream(el, state([{ type: "ui", component: "other", props: {}, id: 3 }]));

      expect(probe(el)).toBeNull();
      expect(root(el).querySelector("test-other-widget")).toBeInstanceOf(OtherWidget);
    });

    it("renders nothing for an unknown component outside debug mode", async () => {
      const el = await mount(state([{ type: "ui", component: "nope", props: {}, id: 1 }], true));
      expect(root(el).querySelector(".unknown-fallback")).toBeNull();
    });

    it("shows an unknown-component diagnostic in debug mode", async () => {
      const el = await mount(state([{ type: "ui", component: "nope", props: {}, id: 1 }], true), { debug: true });
      expect(root(el).querySelector(".unknown-fallback")?.textContent).toContain('"nope"');
    });

    it("validates props against a registered schema", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const schema = {
        safeParse: (v: unknown) =>
          (v as { label?: unknown }).label === "ok"
            ? { success: true }
            : { success: false, error: "label must be ok" },
      };
      GenUIRegistry.register("validated", ProbeWidget, { schema });

      const bad = await mount(state([{ type: "ui", component: "validated", props: { label: 1 }, id: 1 }], true));
      expect(root(bad).querySelector(".error-fallback")?.textContent).toContain('"validated"');
      expect(probe(bad)).toBeNull();
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("validated"), "label must be ok");

      const good = await mount(state([{ type: "ui", component: "validated", props: { label: "ok" }, id: 1 }], true));
      expect(root(good).querySelector(".error-fallback")).toBeNull();
      expect(probe(good).label).toBe("ok");

      GenUIRegistry.unregister("validated");
      errSpy.mockRestore();
    });
  });

  describe("injected component API", () => {
    it("sendEvent bubbles genui-send-event stamped with message id, source id and component", async () => {
      const el = await mount(state([{ type: "ui", component: "probe", props: {}, id: 42 }]));
      const spy = vi.fn();
      document.body.addEventListener("genui-send-event", spy as EventListener);

      probe(el).sendEvent!("clicked", { a: 1 }, { text: "Clicked!" });

      expect(spy).toHaveBeenCalledOnce();
      const evt = spy.mock.calls[0]![0] as CustomEvent;
      expect(evt.composed).toBe(true);
      expect(evt.detail).toEqual({
        msgId: "msg-1",
        eventType: "clicked",
        payload: { a: 1 },
        sourceId: 42,
        component: "probe",
        text: "Clicked!",
      });
      document.body.removeEventListener("genui-send-event", spy as EventListener);
    });

    it("sendEvent also delivers to in-message listeners scoped to the same component", async () => {
      const el = await mount(state([
        { type: "ui", component: "probe", props: {}, id: 1 },
        { type: "ui", component: "probe", props: {}, id: 2 },
      ]));
      const [a, b] = Array.from(root(el).querySelectorAll("test-probe-widget")) as ProbeWidget[];
      const onA = vi.fn();
      const onB = vi.fn();
      a!.listenEvent!("ping", onA);
      b!.listenEvent!("ping", onB);

      a!.sendEvent!("ping", "from-a");

      expect(onA).toHaveBeenCalledWith("from-a");
      expect(onB).not.toHaveBeenCalled();
    });

    it("tFn translates through i18next with a fallback", async () => {
      const el = await mount(state([{ type: "ui", component: "probe", props: {}, id: 1 }]));
      const w = probe(el);
      expect(w.tFn!("greet")).toBe("Hello");
      expect(w.tFn!("missing.key", "Fallback")).toBe("Fallback");
      expect(w.tFn!("missing.key")).toBe("missing.key");
    });

    it("onLangChange subscribes to language changes and returns an unsubscribe", async () => {
      const el = await mount(state([{ type: "ui", component: "probe", props: {}, id: 1 }]));
      const cb = vi.fn();
      const off = probe(el).onLangChange!(cb);

      await i18next.changeLanguage("tr");
      expect(cb).toHaveBeenCalledTimes(1);

      off();
      await i18next.changeLanguage("en");
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe("event chunks", () => {
    it("dispatches each event chunk once to matching listeners", async () => {
      const el = await mount(state([
        { type: "ui", component: "probe", props: {}, id: 1 },
        { type: "ui", component: "probe", props: {}, id: 2 },
      ]));
      const [a, b] = Array.from(root(el).querySelectorAll("test-probe-widget")) as ProbeWidget[];
      const onA = vi.fn();
      const onB = vi.fn();
      a!.listenEvent!("done", onA);
      b!.listenEvent!("done", onB);

      const base: Chunk[] = [
        { type: "ui", component: "probe", props: {}, id: 1 },
        { type: "ui", component: "probe", props: {}, id: 2 },
      ];
      // Targeted at component 2 only.
      await stream(el, state([...base, { type: "event", name: "done", payload: "two", id: 10, for: 2 }]));
      expect(onA).not.toHaveBeenCalled();
      expect(onB).toHaveBeenCalledWith("two");

      // Broadcast (no `for`) reaches both; the earlier chunk is not replayed.
      await stream(el, state([
        ...base,
        { type: "event", name: "done", payload: "two", id: 10, for: 2 },
        { type: "event", name: "done", payload: "all", id: 11 },
        { type: "event", name: "nobody-listens", id: 12 },
      ]));
      expect(onA).toHaveBeenCalledWith("all");
      expect(onB).toHaveBeenCalledTimes(2);
    });

    it("event chunks are never rendered", async () => {
      const el = await mount(state([{ type: "event", name: "x", id: 1 }], true));
      expect(root(el).querySelector(".genui-wrapper")!.children).toHaveLength(0);
    });

    it("drives a real <genui-form> round trip: submit out, form_success back in", async () => {
      const fields = [{ name: "email", label: "Email", type: "email" }];
      const formChunk: Chunk = { type: "ui", component: "genui-form", props: { fields }, id: 5 };
      const el = await mount(state([formChunk]));
      const form = root(el).querySelector("genui-form") as GenUIForm;
      await form.updateComplete;

      const spy = vi.fn();
      el.addEventListener("genui-send-event", spy as EventListener);
      form.shadowRoot!.querySelector<HTMLInputElement>("input")!.value = "a@b.co";
      form.shadowRoot!.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));

      expect((spy.mock.calls[0]![0] as CustomEvent).detail).toMatchObject({
        msgId: "msg-1",
        eventType: "form_submit",
        payload: { email: "a@b.co" },
        sourceId: 5,
        component: "genui-form",
      });

      await stream(el, state([
        formChunk,
        { type: "event", name: "form_success", payload: { message: "Subscribed!" }, id: 6, for: 5 },
      ], true));
      await form.updateComplete;

      expect(form.shadowRoot!.querySelector(".success-message")?.textContent).toBe("Subscribed!");
    });
  });

  describe("chrome", () => {
    it("renders the default robot avatar", async () => {
      const el = await mount(state([], true));
      expect(root(el).querySelector(".avatar svg")).not.toBeNull();
      expect(root(el).querySelector(".avatar img")).toBeNull();
    });

    it("uses the theme's bot avatar image", async () => {
      chatStore.getState().setTheme({ avatar: { bot: "https://example.com/bot.png" } });
      const el = await mount(state([], true));
      expect(root(el).querySelector<HTMLImageElement>(".avatar img")!.getAttribute("src")).toBe(
        "https://example.com/bot.png",
      );
    });

    it("omits the avatar when the theme hides bot avatars", async () => {
      chatStore.getState().setTheme({ avatar: { showBot: false } });
      const el = await mount(state([], true));
      expect(root(el).querySelector(".avatar")).toBeNull();
    });

    it("keeps the avatar gutter but hides it when hideAvatar is set", async () => {
      const el = await mount(state([], true), { hideAvatar: true });
      expect(root(el).querySelector(".avatar")!.classList.contains("hidden")).toBe(true);
    });

    it("shows a timestamp only when one is provided", async () => {
      const without = await mount(state([], true));
      expect(root(without).querySelector(".time")).toBeNull();

      const withTime = await mount(state([], true), { timestamp: new Date(2025, 0, 1, 9, 5).getTime() });
      expect(root(withTime).querySelector(".time")?.textContent).toMatch(/\d/);
    });
  });
});
