/**
 * IMessageRenderer — Contract for message display components.
 *
 * Every custom message type component must satisfy this interface.
 * No external dependencies allowed in this file.
 */

export interface IMessageRenderer {
  /** The message type key this renderer handles (e.g. "text", "card"). */
  readonly messageType?: string;

  /** The message data payload passed from the incoming message. */
  messageData: Record<string, unknown>;
}
