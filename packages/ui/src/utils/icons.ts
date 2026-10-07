import type { SVGTemplateResult } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { chatStore, type IconName } from "@chativa/core";

/**
 * Renders `theme.icons[name]` (inner SVG markup, e.g. `<path d="..."/>`) inside
 * chativa's own `<svg>` wrapper when the host app has overridden it, otherwise
 * renders `fallback` (the built-in icon content).
 *
 * The fallback must be an `svg` template: it is rendered inside an `<svg>`, and
 * an `html` template there creates its shapes in the HTML namespace, where
 * they never paint.
 */
export function renderIcon(name: IconName, fallback: SVGTemplateResult): unknown {
  const custom = chatStore.getState().theme.icons?.[name];
  return custom ? unsafeSVG(custom) : fallback;
}
