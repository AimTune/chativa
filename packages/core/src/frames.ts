/**
 * `@chativa/core/frames` — the wire-frame vocabulary, as a standalone entry.
 *
 * Connector packages ship tiny self-contained CDN bundles, so they import from
 * `@chativa/core` with `import type` only — a value import from the main entry
 * would inline all of core (store, i18n, Lit elements) into every connector's
 * standalone build, which measured at 26× the bundle size.
 *
 * This entry exists so connectors can share the frame-routing rules *as code*
 * without paying for that: everything reachable from here is pure and
 * dependency-free, so a connector inlines roughly a kilobyte.
 *
 * Import from here — not from the package root — in any connector:
 *
 *     import { parseChatFrame } from "@chativa/core/frames";
 */

export type { ChatFrame, ParseChatFrameOptions } from "./domain/entities/ChatFrame";
export { parseChatFrame, createGenUIEventFrame } from "./domain/entities/ChatFrame";

// The component-catalog cache: pure logic plus an injectable storage adapter, so
// a connector can do the ETag handshake without pulling in the package root.
export { createGenUIComponentCache } from "./domain/entities/GenUIComponentCache";
export type {
  GenUIComponentCache,
  GenUIComponentCacheOptions,
  GenUIComponentCacheStorage,
  CachedGenUIComponents,
} from "./domain/entities/GenUIComponentCache";
export type { GenUIComponentDefinition } from "./domain/entities/GenUI";
