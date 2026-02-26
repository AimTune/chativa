/**
 * Conversation — domain entity for multi-conversation / agent-panel mode.
 *
 * No external dependencies allowed in this file.
 */

export type ConversationStatus = "open" | "pending" | "resolved" | "closed";

export interface Conversation {
  /** Unique identifier. */
  id: string;
  /** Display title (e.g. "Support Request #1234"). */
  title: string;
  /** Contact name / customer name. */
  contact?: string;
  /** Optional avatar URL. */
  avatar?: string;
  /** Preview of the last message. */
  lastMessage?: string;
  /** Timestamp of the last message. */
  lastMessageAt?: number;
  /** Number of unread messages for this conversation. */
  unreadCount?: number;
  status: ConversationStatus;
  /** Arbitrary extra data from the connector. */
  metadata?: Record<string, unknown>;
}
