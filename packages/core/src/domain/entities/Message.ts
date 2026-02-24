/**
 * Domain entities for messages.
 * No external dependencies allowed in this file.
 */

export type MessageSender = "user" | "bot";

/** Delivery/read status for a message. */
export type MessageStatus = "sending" | "sent" | "read";

/** A tappable chip/button sent alongside a bot message. */
export interface MessageAction {
  label: string;
  /** Text to send when tapped; falls back to `label` if omitted. */
  value?: string;
}

export interface IncomingMessage {
  id: string;
  type: string;
  from?: MessageSender;
  data: Record<string, unknown>;
  timestamp?: number;
  /** Optional quick-reply chips rendered below the message bubble. */
  actions?: MessageAction[];
}

export interface OutgoingMessage {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp?: number;
}

/** Result returned by IConnector.loadHistory(). */
export interface HistoryResult {
  messages: IncomingMessage[];
  hasMore: boolean;
  /** Opaque cursor passed back to load the next (older) page. */
  cursor?: string;
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
