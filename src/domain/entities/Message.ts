/**
 * Domain entities for messages.
 * No external dependencies allowed in this file.
 */

export interface IncomingMessage {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp?: number;
}

export interface OutgoingMessage {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp?: number;
}

export function createOutgoingMessage(
  text: string,
  type = "text"
): OutgoingMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    data: { text },
    timestamp: Date.now(),
  };
}
