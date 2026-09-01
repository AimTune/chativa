import type { PropertyDeclaration } from "lit";
import type { GenUIComponentDefinition } from "../domain/entities/GenUI";
import { GenUIHtmlElement } from "./GenUIHtmlElement";
import { renderTemplate } from "./template";

/** Definition-derived classes, keyed by `name@version`, so a re-announced catalog reuses them. */
const _defined = new Map<string, typeof GenUIHtmlElement>();

/** `Order Card` → `order-card`; the result always contains a dash (custom elements require one). */
function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "component";
}

/** A tag nobody has claimed yet — a redefined component can't reuse its old tag. */
function freeTag(preferred: string): string {
  let tag = preferred;
  let n = 1;
  while (customElements.get(tag)) tag = `${preferred}-${n++}`;
  return tag;
}

/** Attribute conversion follows the declared default, so plain-HTML usage works too. */
function declarationFor(value: unknown): PropertyDeclaration {
  if (typeof value === "number") return { type: Number };
  if (typeof value === "boolean") return { type: Boolean };
  if (value !== null && typeof value === "object") return { type: Object };
  return { type: String };
}

/**
 * Turn a server-supplied {@link GenUIComponentDefinition} into a registered
 * custom element class.
 *
 * The returned class extends `GenUIHtmlElement`, so it inherits the sanitizer,
 * the `data-event` round trip and the whole `GenUIComponentAPI` — it only swaps
 * *where the markup comes from*: the definition's template, rendered against the
 * component's declared props.
 *
 * Calling it twice with the same `name@version` returns the same class, so a
 * reconnect that re-announces the catalog is a no-op instead of a leak of
 * custom-element definitions.
 *
 * @example
 * ```ts
 * const OrderCard = defineGenUIComponent({
 *   name: "order-card",
 *   template: `<div class="card"><h3>{{title}}</h3>
 *     {{#each lines}}<p>{{this.label}} — {{this.price}}</p>{{/each}}
 *     <button data-event="track_order" data-payload='{"id":"{{id}}"}'>Track</button></div>`,
 *   css: `.card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }`,
 *   props: { id: "", title: "", lines: [] },
 * });
 *
 * GenUIRegistry.register("order-card", OrderCard);   // done for you by @chativa/genui
 * ```
 */
export function defineGenUIComponent(
  definition: GenUIComponentDefinition
): typeof GenUIHtmlElement {
  const key = `${definition.name}@${definition.version ?? "1"}`;
  const cached = _defined.get(key);
  if (cached) return cached;

  const declaredProps = definition.props ?? {};
  const propNames = Object.keys(declaredProps);

  const properties: Record<string, PropertyDeclaration> = {};
  for (const [name, value] of Object.entries(declaredProps)) {
    // `html` / `css` / `unsafe` belong to the base element — a definition prop
    // may not take them over, or a template could turn its own sanitizer off.
    if (name === "html" || name === "css" || name === "unsafe") continue;
    properties[name] = declarationFor(value);
  }

  class DefinedGenUIComponent extends GenUIHtmlElement {
    static override properties = properties;

    /** The metadata this class was built from — handy when debugging a catalog. */
    static readonly definition: GenUIComponentDefinition = definition;

    constructor() {
      super();
      // Defaults from the definition, so a chunk may send only what changed.
      for (const name of propNames) {
        if (name === "html" || name === "css" || name === "unsafe") continue;
        (this as unknown as Record<string, unknown>)[name] = structuredCloneish(declaredProps[name]);
      }
      this.css = definition.css ?? "";
    }

    protected override markup(): string {
      const scope: Record<string, unknown> = {};
      for (const name of propNames) {
        scope[name] = (this as unknown as Record<string, unknown>)[name];
      }
      return renderTemplate(definition.template, scope);
    }
  }

  const tag = freeTag(definition.tag ?? `chativa-genui-${slugify(definition.name)}`);
  customElements.define(tag, DefinedGenUIComponent);

  _defined.set(key, DefinedGenUIComponent);
  return DefinedGenUIComponent;
}

/** Defaults must not be shared between instances — an `each` list would alias. */
function structuredCloneish(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuredCloneish);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, structuredCloneish(v)])
    );
  }
  return value;
}

/** Forget every derived class — tests only. */
export function clearDefinedGenUIComponents(): void {
  _defined.clear();
}
