import { html, nothing, type PropertyDeclarations, type TemplateResult } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { GenUIEventScope } from "../domain/entities/GenUI";
import { GenUIElement } from "./GenUIElement";

/** Tags dropped by {@link sanitizeHtml} — they execute code or load remote documents. */
const BLOCKED_TAGS = new Set([
  "SCRIPT", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "BASE", "FRAME", "FRAMESET", "NOSCRIPT",
]);

/** Attributes whose value is a URL and therefore needs a scheme check. */
const URL_ATTRS = new Set(["href", "src", "action", "formaction", "poster", "xlink:href", "srcset"]);

/** Schemes allowed in URL attributes. Notably excludes `javascript:` and `vbscript:`. */
const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel", "sms", "ftp"]);

/** `data:` is only allowed for images. */
const DATA_IMAGE = /^data:image\/[a-z0-9.+-]+[;,]/i;

/**
 * Relative URLs are fine; an absolute one must use a scheme we trust.
 *
 * Whitespace and control characters are stripped first — `java\tscript:` is the
 * classic way past a naive prefix check.
 */
function isSafeUrl(value: string): boolean {
  const v = value.replace(/[\s\u0000-\u001F]/g, "");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(v);
  if (!scheme) return true;
  if (DATA_IMAGE.test(v)) return true;
  return SAFE_SCHEMES.has(scheme[1]!.toLowerCase());
}

/**
 * Strip anything script-like out of untrusted markup.
 *
 * Removes {@link BLOCKED_TAGS}, every `on*` event attribute, and URL attributes
 * whose scheme isn't trusted (`javascript:`, `vbscript:`, …).
 * Everything else — structure, classes, inline styles — is left intact.
 *
 * Exported so hosts can pre-sanitize markup before it reaches the widget.
 */
export function sanitizeHtml(markup: string): string {
  const tpl = document.createElement("template");
  tpl.innerHTML = markup;

  for (const el of Array.from(tpl.content.querySelectorAll("*"))) {
    if (BLOCKED_TAGS.has(el.tagName)) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      } else if (URL_ATTRS.has(name) && !isSafeUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return tpl.innerHTML;
}

/**
 * `<chativa-html>` — render markup that arrives from anywhere.
 *
 * The escape hatch for teams that don't want to compile a LitElement per widget:
 * a backend streams a chunk, a React app sets a prop, or a plain HTML page
 * writes children — the same element renders it and routes interactions back to
 * the connector.
 *
 * ### 1. From a connector / backend
 * ```json
 * { "type": "ui", "component": "genui-html",
 *   "props": {
 *     "html": "<div class='card'><h3>Order #123</h3><button data-event='track_order' data-payload='{\"id\":123}'>Track</button></div>",
 *     "css":  ".card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }"
 *   } }
 * ```
 * The button click arrives at the connector via `receiveComponentEvent(streamId, "track_order", { id: 123 })`.
 *
 * ### 2. From plain HTML (children are used when no `html` prop is set)
 * ```html
 * <chativa-html>
 *   <button data-event="say_hi">Hi</button>
 * </chativa-html>
 * ```
 *
 * ### 3. From React
 * ```tsx
 * <chativa-html
 *   ref={(el) => { if (el) el.html = markup; }}
 *   onGenuiComponentEvent={...}  // or: el.addEventListener("genui-component-event", ...)
 * />
 * ```
 *
 * ### Interaction contract
 *
 * A click (or form submit) on an element carrying an event attribute sends that
 * event. Which attribute you use says **who the interaction is addressed to**,
 * for backends that model the distinction (mekik `PROTOCOL.md` §10.4):
 *
 * | attribute | `scope` sent | meaning |
 * | --- | --- | --- |
 * | `component-event="<name>"` | `"component"` | the widget's own conversation with the node that mounted it |
 * | `mekik-event="<name>"` | `"graph"` | the application, which may start a new turn |
 * | `data-event="<name>"` | none | let the backend decide (the original form) |
 *
 * Only the most specific attribute on an element is used, in the order above. An
 * empty value is not a trigger.
 *
 * - `data-payload='<json>'` → parsed and sent as the payload (invalid JSON is
 *   sent as the raw string).
 * - A `<form component-event="...">` (or `mekik-event` / `data-event`) sends its
 *   named fields, merged over `data-payload`, and its default submit is prevented.
 *
 * ### Safety
 * Markup is sanitized by default ({@link sanitizeHtml}). Set the `unsafe`
 * attribute/property to render it verbatim — only for markup you control, since
 * it re-enables `<script>` and inline handlers.
 */
export class GenUIHtmlElement extends GenUIElement {
  static override properties: PropertyDeclarations = {
    html: { type: String },
    css: { type: String },
    unsafe: { type: Boolean },
  };

  /** Markup to render. When empty, the element's light-DOM children are shown. */
  html = "";

  /** Optional CSS, scoped to this element's shadow root. */
  css = "";

  /** Skip sanitization. Only for markup you fully control. */
  unsafe = false;

  /**
   * Delegate interactions on the shadow root — it has the same lifetime as the
   * element, and slotted light-DOM children bubble through it too, so both the
   * `html` prop and the children form work with one pair of listeners.
   */
  override createRenderRoot(): HTMLElement | DocumentFragment {
    const root = super.createRenderRoot();
    root.addEventListener("click", this._onClick);
    root.addEventListener("submit", this._onSubmit);
    return root;
  }

  /**
   * The event attributes, most specific first. The attribute an author writes is
   * how they say *who the interaction is for* — see {@link GenUIEventScope}.
   */
  private static readonly EVENT_ATTRS: ReadonlyArray<{ attr: string; scope?: GenUIEventScope }> = [
    { attr: "component-event", scope: "component" },
    { attr: "mekik-event", scope: "graph" },
    { attr: "data-event" },
  ];

  /** Nearest ancestor carrying an event attribute, searched only within this element. */
  private _findTrigger(e: Event): { el: HTMLElement; name: string; scope?: GenUIEventScope } | null {
    for (const node of e.composedPath()) {
      if (node === this || node === this.renderRoot) break;
      if (!(node instanceof HTMLElement)) continue;
      for (const { attr, scope } of GenUIHtmlElement.EVENT_ATTRS) {
        const name = node.getAttribute(attr);
        // An empty value is not a name — treat it as "not a trigger" rather than
        // firing an event nothing can be listening for.
        if (name) return { el: node, name, ...(scope ? { scope } : {}) };
      }
    }
    return null;
  }

  /** `data-payload` as JSON; the raw string when it isn't valid JSON. */
  private _payloadOf(el: HTMLElement): unknown {
    const raw = el.getAttribute("data-payload");
    if (raw === null) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  /**
   * Send the interaction, passing routing metadata only when the markup declared
   * it — a plain `data-event` keeps the two-argument call it has always made.
   */
  private _send(trigger: { scope?: GenUIEventScope; name: string }, payload: unknown): void {
    if (trigger.scope) this.sendEvent(trigger.name, payload, { scope: trigger.scope });
    else this.sendEvent(trigger.name, payload);
  }

  private _onClick = (e: Event): void => {
    const trigger = this._findTrigger(e);
    if (!trigger || trigger.el instanceof HTMLFormElement) return;
    this._send(trigger, this._payloadOf(trigger.el));
  };

  private _onSubmit = (e: Event): void => {
    const trigger = this._findTrigger(e);
    if (!trigger || !(trigger.el instanceof HTMLFormElement)) return;
    const form = trigger.el;
    e.preventDefault();

    const base = this._payloadOf(form);
    const fields = Object.fromEntries(new FormData(form).entries());
    const payload =
      base && typeof base === "object" ? { ...(base as Record<string, unknown>), ...fields } : fields;

    this._send(trigger, payload);
  };

  /**
   * The markup to render, before sanitization.
   *
   * Subclasses override this to compute markup from something other than the
   * `html` prop — `defineGenUIComponent` renders a server-supplied template
   * against the component's declared props here.
   */
  protected markup(): string {
    return this.html;
  }

  override render(): TemplateResult {
    const raw = this.markup();
    const markup = this.unsafe ? raw : sanitizeHtml(raw);
    return html`
      ${this.css ? html`<style>${this.css}</style>` : nothing}
      ${raw ? unsafeHTML(markup) : html`<slot></slot>`}
    `;
  }
}

if (!customElements.get("chativa-html")) {
  customElements.define("chativa-html", GenUIHtmlElement);
}
