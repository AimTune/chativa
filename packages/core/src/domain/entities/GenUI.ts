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
  /** Arbitrary payload delivered to listeners. */
  payload: unknown;
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
