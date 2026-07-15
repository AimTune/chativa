/**
 * Domain entities for connector tool calls (agent/LLM tool use).
 * No external dependencies allowed in this file.
 */

/** Lifecycle state of a single tool invocation. */
export type ToolCallStatus = "running" | "completed" | "error";

/**
 * A single tool invocation reported by a connector.
 *
 * Connectors emit the same `id` multiple times as the call progresses
 * (running → completed/error); consumers upsert by `id`.
 */
export interface ToolCall {
  /** Unique id for this invocation (e.g. an Anthropic `tool_use` id). */
  id: string;
  /** Tool name, e.g. "get_weather". */
  name: string;
  /** Human-readable description of what the tool is doing, shown in the activity line. */
  description?: string;
  status: ToolCallStatus;
  /** Input parameters the tool was invoked with. */
  params?: Record<string, unknown>;
  /** Result payload — present once `status` is "completed". */
  result?: unknown;
  /** Error message — present once `status` is "error". */
  error?: string;
  /** Epoch ms when the call started. */
  startedAt?: number;
  /** Epoch ms when the call settled (completed or error). */
  endedAt?: number;
}

/** Callback registered via IConnector.onToolCall(). */
export type ToolCallHandler = (toolCall: ToolCall) => void;
