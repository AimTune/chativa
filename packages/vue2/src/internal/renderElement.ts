import { h, type VNode, type VNodeChildren, type VNodeData } from "vue";

/**
 * Renders a raw custom-element vnode (`<chat-iva>`, `<genui-message>` …).
 *
 * `data.pre` matters: once the plugin registers the wrappers globally as
 * `ChatIva` / `ChatBotButton`, Vue 2 resolves the kebab-case tag
 * `chat-iva` to the *wrapper component itself* (component lookup tries the
 * camelized and capitalized forms of a tag). Without `pre`, the wrapper's
 * own render would recurse into itself forever. `pre` makes `createElement`
 * skip component resolution and the "unknown custom element" dev warning —
 * exactly what a `v-pre` subtree does.
 */
export function renderElement(tag: string, data: VNodeData, children?: VNodeChildren): VNode {
  return h(tag, { ...data, pre: true } as VNodeData, children);
}

/** Copies only the keys whose value is not `undefined`, so the element keeps its own defaults for unset props. */
export function definedOnly(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Reads the `detail` of a DOM `CustomEvent` (or `undefined` for a plain `Event`). */
export function detailOf<T = unknown>(event: Event): T {
  return (event as CustomEvent<T>).detail;
}
