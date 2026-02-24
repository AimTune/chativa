import type { AIChunk } from "@chativa/core";

/**
 * Parse a streaming NDJSON (Newline Delimited JSON) fetch response into
 * `AIChunk` objects.
 *
 * @example
 * const response = await fetch("/api/chat/stream");
 * for await (const chunk of streamFromFetch(response)) {
 *   // process chunk
 * }
 */
export async function* streamFromFetch(response: Response): AsyncGenerator<AIChunk> {
  if (!response.body) throw new Error("[GenUI] Response body is empty");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split by newline to handle NDJSON
      const lines = buffer.split("\n");
      // Keep the last potentially partial line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          yield JSON.parse(trimmed) as AIChunk;
        } catch (e) {
          console.error("[GenUI] Failed to parse chunk:", trimmed, e);
        }
      }
    }

    // Process any remaining buffer content
    const remaining = buffer.trim();
    if (remaining) {
      try {
        yield JSON.parse(remaining) as AIChunk;
      } catch (e) {
        console.error("[GenUI] Failed to parse final chunk:", remaining, e);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
