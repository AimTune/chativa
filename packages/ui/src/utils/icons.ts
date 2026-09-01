import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { chatStore, type IconName } from "@chativa/core";

/**
 * Renders `theme.icons[name]` (inner SVG markup, e.g. `<path d="..."/>`) inside
 * chativa's own `<svg>` wrapper when the host app has overridden it, otherwise
 * renders `fallback` (the built-in icon content).
 */
export function renderIcon(name: IconName, fallback: unknown): unknown {
  const custom = chatStore.getState().theme.icons?.[name];
  return custom ? unsafeSVG(custom) : fallback;
}
