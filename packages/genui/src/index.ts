// @chativa/genui — Generative UI streaming for Chativa chat widget

// ── i18n resources (EN/TR) — registered as a side-effect ─────────────────────
import "./i18n/index";

// ── Registry ──────────────────────────────────────────────────────────────────
export { GenUIRegistry } from "./registry/GenUIRegistry";
export type { GenUIEntry, GenUISchema } from "./registry/GenUIRegistry";

// ── Shared types ──────────────────────────────────────────────────────────────
export type { GenUIComponentAPI } from "./types";

// ── Components (side-effects: registers custom elements) ──────────────────────
export { GenUIMessage } from "./components/GenUIMessage";
export { GenUITextBlock } from "./components/GenUITextBlock";
export { GenUICard } from "./components/GenUICard";
export type { GenUICardAction } from "./components/GenUICard";
export { GenUIForm } from "./components/GenUIForm";
export type { GenUIFormField } from "./components/GenUIForm";
export { GenUIAlert } from "./components/GenUIAlert";
export type { GenUIAlertVariant } from "./components/GenUIAlert";
export { GenUIQuickReplies } from "./components/GenUIQuickReplies";
export type { GenUIQuickReplyItem } from "./components/GenUIQuickReplies";
export { GenUIList } from "./components/GenUIList";
export type { GenUIListItem } from "./components/GenUIList";
export { GenUITable } from "./components/GenUITable";
export { GenUIRating } from "./components/GenUIRating";
export { GenUIProgress } from "./components/GenUIProgress";
export type { GenUIProgressVariant } from "./components/GenUIProgress";
export { GenUIDatePicker } from "./components/GenUIDatePicker";
export { GenUIChart } from "./components/GenUIChart";
export type { GenUIDataset } from "./components/GenUIChart";
export { GenUISteps } from "./components/GenUISteps";
export type { GenUIStep } from "./components/GenUISteps";
export { GenUIImageGallery } from "./components/GenUIImageGallery";
export type { GenUIImage } from "./components/GenUIImageGallery";
export { GenUITypewriter } from "./components/GenUITypewriter";

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
import { GenUIAlert } from "./components/GenUIAlert";
import { GenUIQuickReplies } from "./components/GenUIQuickReplies";
import { GenUIList } from "./components/GenUIList";
import { GenUITable } from "./components/GenUITable";
import { GenUIRating } from "./components/GenUIRating";
import { GenUIProgress } from "./components/GenUIProgress";
import { GenUIDatePicker } from "./components/GenUIDatePicker";
import { GenUIChart } from "./components/GenUIChart";
import { GenUISteps } from "./components/GenUISteps";
import { GenUIImageGallery } from "./components/GenUIImageGallery";
import { GenUITypewriter } from "./components/GenUITypewriter";

GenUIRegistry.register("genui-text",          GenUITextBlock as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-card",          GenUICard as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-form",          GenUIForm as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-alert",         GenUIAlert as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-quick-replies", GenUIQuickReplies as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-list",          GenUIList as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-table",         GenUITable as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-rating",        GenUIRating as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-progress",      GenUIProgress as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-date-picker",   GenUIDatePicker as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-chart",         GenUIChart as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-steps",         GenUISteps as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-image-gallery", GenUIImageGallery as unknown as typeof HTMLElement);
GenUIRegistry.register("genui-typewriter",    GenUITypewriter as unknown as typeof HTMLElement);
