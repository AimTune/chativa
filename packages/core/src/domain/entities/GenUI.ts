/**
 * GenUI — Domain types for Generative UI streaming.
 *
 * These types define the chunk protocol used by connectors that support
 * streaming LitElement components inline inside chat messages.
 *
 * No external dependencies allowed in this file.
 */

/** A text chunk renders plain text or markdown inside the message bubble. */
export interface AIChunkText {
  type: "text";
  /** Markdown-compatible content string. */
  content: string;
  /** Unique id within the stream, used for keying and event targeting. */
  id: number;
}

/** A UI chunk mounts a registered LitElement component by name. */
export interface AIChunkUI {
  type: "ui";
  /** Name used to look up the component in GenUIRegistry. */
  component: string;
  /** Props passed directly to the component instance. */
  props: Record<string, unknown>;
  /** Unique id within the stream — components can receive events via this id. */
  id: number;
}

/** An event chunk dispatches a named event to a target component or globally. */
export interface AIChunkEvent {
  type: "event";
  /** Event name (e.g. "form_success"). */
  name: string;
  /** Arbitrary payload delivered to listeners. Omitted for signal-only events. */
  payload?: unknown;
  /** Unique id of this chunk (for deduplication). */
  id: number;
  /**
   * Target component id. If omitted the event is broadcast to all listeners
   * in the same message bubble.
   */
  for?: number;
}

export type AIChunk = AIChunkText | AIChunkUI | AIChunkEvent;

/** Shape of the `data` field stored in a `genui` IncomingMessage. */
export interface GenUIStreamState {
  chunks: AIChunk[];
  /** True once the connector signals that no more chunks will arrive. */
  streamingComplete: boolean;
}

/**
 * Callback registered via `IConnector.onGenUIChunk`.
 *
 * @param streamId  Opaque identifier that groups all chunks of one turn.
 * @param chunk     The chunk delivered in this call.
 * @param done      True when the connector has finished streaming this turn.
 */
export type GenUIChunkHandler = (
  streamId: string,
  chunk: AIChunk,
  done: boolean
) => void;

/**
 * A component the *server* defines, shipped to the client so it can be rendered
 * without any client-side build step.
 *
 * The backend author writes the component once (a class in mekik, say), the
 * server turns it into this metadata, and the connector hands it over on
 * connect — the client registers it in its GenUI registry and from then on a
 * plain `{ type: "ui", component: "<name>", props }` chunk mounts it.
 *
 * Templates are markup, never code: see `renderTemplate` for the supported
 * subset (`{{value}}`, `{{#if}}`, `{{#each}}`). Rendered output is sanitized
 * before it reaches the DOM — a server definition cannot opt out of that.
 */
export interface GenUIComponentDefinition {
  /** Registry name used by `AIChunkUI.component`, e.g. `"order-card"`. */
  name: string;
  /** Markup with `{{…}}` placeholders. */
  template: string;
  /** Optional CSS, scoped to the component's shadow root. */
  css?: string;
  /**
   * Declared props: name → default value. Drives both the template scope and
   * the client's reactivity, so a re-sent chunk updates the widget in place.
   */
  props?: Record<string, unknown>;
  /**
   * Definition version. A changed version re-registers the component instead of
   * reusing the previously defined class.
   */
  version?: string;
  /** Custom element tag to define. Derived from `name` when omitted. */
  tag?: string;
}

/** Callback registered via `IConnector.onGenUIComponents`. */
export type GenUIComponentsHandler = (
  definitions: GenUIComponentDefinition[]
) => void;

/**
 * Who a component interaction is addressed to, when the backend distinguishes
 * (mekik `PROTOCOL.md` §10.4).
 *
 * - `"component"` — the widget's own conversation with the graph node that
 *   mounted it: only a node parked waiting for this event name receives it.
 * - `"graph"` — the application: it may start a new turn on the interaction.
 *
 * Omit it and the backend decides; mekik tries the component route first, then
 * the graph one. Backends that do not model the distinction ignore it.
 */
export type GenUIEventScope = "component" | "graph";

/** Optional routing metadata that travels with a component event. */
export interface GenUIEventOptions {
  /** See {@link GenUIEventScope}. */
  scope?: GenUIEventScope;
  /**
   * Registry name of the component the interaction came from. `GenUIMessage`
   * fills this in from the chunk, so components never set it themselves.
   */
  component?: string;
}

/**
 * API that `GenUIMessage` injects into every mounted GenUI component instance.
 *
 * `GenUIElement` implements all four with working defaults, so extending it is
 * the recommended way to consume this contract — the injection simply shadows
 * the defaults with message-scoped versions.
 */
export interface GenUIComponentAPI {
  /**
   * Send an event to the connector (e.g. `"form_submit"`, `"rating_submit"`).
   *
   * `opts` is routing metadata for backends that distinguish who an interaction
   * is for; leave it off and the backend decides. See {@link GenUIEventOptions}.
   */
  sendEvent(type: string, payload: unknown, opts?: GenUIEventOptions): void;
  /** Listen for a server-originated event within this message scope. */
  listenEvent(type: string, cb: (payload: unknown) => void): void;
  /**
   * Translate a key using the shared i18next instance.
   * Falls back to `fallback` if the key is not found.
   * Named `tFn` (not `translate`) to avoid conflict with the native
   * `HTMLElement.translate` boolean attribute.
   */
  tFn(key: string, fallback?: string): string;
  /**
   * Subscribe to locale changes so you can call `requestUpdate()`.
   * Returns an unsubscribe function — call it in `disconnectedCallback`.
   */
  onLangChange(cb: () => void): () => void;
}
