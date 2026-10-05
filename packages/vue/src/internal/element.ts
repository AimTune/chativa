import {
  camelize,
  capitalize,
  h,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  toRaw,
  type Ref,
  type VNode,
  type VNodeArrayChildren,
} from "vue";
import { canUseDOM } from "./env";

/**
 * Loads the module that defines a custom element — a dynamic `import()` of
 * `@chativa/ui` / `@chativa/genui` — once the calling component has mounted on
 * the client, and flips the returned ref to `true` when it has resolved.
 *
 * `onMounted` never runs during server rendering, so nothing here touches
 * `window` / `document` / `customElements` on the server: the wrappers render
 * a comment placeholder there and the real element appears after hydration.
 */
export function useLazyElement(load: () => Promise<unknown>): Readonly<Ref<boolean>> {
  const ready = shallowRef(false);
  let active = true;

  onMounted(() => {
    if (!canUseDOM()) return;
    void load().then(() => {
      if (active) ready.value = true;
    });
  });

  onBeforeUnmount(() => {
    active = false;
  });

  return ready;
}

/**
 * Renders a custom element with every entry of `domProps` set as a **DOM
 * property** (Vue's `.prop` binding — so objects/booleans/numbers reach the
 * LitElement as-is instead of being stringified into attributes) and each
 * `domEvents` entry attached as a native listener for its kebab-case event.
 * `undefined` props are skipped, leaving the element's own default in place.
 */
export function renderCustomElement(
  tag: string,
  options: {
    domProps?: Record<string, unknown>;
    domEvents?: Record<string, (event: Event) => void>;
    ref?: Ref<HTMLElement | null>;
  },
  children?: VNodeArrayChildren,
): VNode {
  const vnodeProps: Record<string, unknown> = {};
  if (options.ref) vnodeProps.ref = options.ref;
  for (const [key, value] of Object.entries(options.domProps ?? {})) {
    // `toRaw` unwraps Vue reactive proxies (e.g. `:message-data="state"` from a
    // `reactive()`/`ref()`) so the LitElement receives the plain object.
    if (value !== undefined) vnodeProps[`.${key}`] = toRaw(value);
  }
  for (const [event, listener] of Object.entries(options.domEvents ?? {})) {
    // Vue hyphenates `onFooBar` back to the `foo-bar` DOM event name.
    vnodeProps[`on${capitalize(camelize(event))}`] = listener;
  }
  return h(tag, vnodeProps, children);
}
