// @chativa/genui — Generative UI streaming for Chativa chat widget

// ── i18n resources (EN/TR) — registered as a side-effect ─────────────────────
import "./i18n/index";

// ── Registry ──────────────────────────────────────────────────────────────────
export { GenUIRegistry } from "./registry/GenUIRegistry";
export type { GenUIEntry, GenUISchema } from "./registry/GenUIRegistry";

// ── Components (side-effects: registers custom elements) ──────────────────────
export { GenUIMessage } from "./components/GenUIMessage";
export { GenUITextBlock } from "./components/GenUITextBlock";
export { GenUICard } from "./components/GenUICard";
export type { GenUICardAction } from "./components/GenUICard";
export { GenUIForm } from "./components/GenUIForm";
export type { GenUIFormField } from "./components/GenUIForm";

// ── Utilities ─────────────────────────────────────────────────────────────────
export { streamFromFetch } from "./utils/streamFromFetch";

// ── Re-export core GenUI types for convenience ────────────────────────────────
export type {
  AIChunk,
  AIChunkText,
  AIChunkUI,
  AIChunkEvent,
  GenUIStreamState,
  GenUIChunkHandler,
} from "@chativa/core";

// ── Register built-in components in GenUIRegistry ─────────────────────────────
// These are available out-of-the-box without any additional registration.
import { GenUIRegistry } from "./registry/GenUIRegistry";
import { GenUITextBlock } from "./components/GenUITextBlock";
import { GenUICard } from "./components/GenUICard";
import { GenUIForm } from "./components/GenUIForm";

GenUIRegistry.register("genui-text", GenUITextBlock as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-card", GenUICard as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-form", GenUIForm as unknown as typeof HTMLElement);
