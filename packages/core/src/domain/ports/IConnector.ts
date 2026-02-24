/**
 * IConnector — Port definition for all chat backends.
 *
 * Implement this interface to create a plug-and-play connector
 * (WebSocket, SignalR, DirectLine, REST, etc.)
 *
 * No external dependencies allowed in this file.
 */

import type { IncomingMessage, OutgoingMessage, HistoryResult, MessageStatus } from "../entities/Message";
import type { GenUIChunkHandler } from "../entities/GenUI";

export type MessageHandler = (message: IncomingMessage) => void;
export type ConnectHandler = () => void;
export type DisconnectHandler = (reason?: string) => void;
export type TypingHandler = (isTyping: boolean) => void;
export type FeedbackType = "like" | "dislike";
export type MessageStatusHandler = (messageId: string, status: MessageStatus) => void;

export interface IConnector {
  /** Unique identifier used to select this connector at runtime. */
  readonly name: string;

  /**
   * Whether sent messages should be added to chat history immediately.
   * Set to false for connectors like DirectLine where the bot echoes back.
   * Default: true
   */
  readonly addSentToHistory?: boolean;

  /** Establish connection to the backend. */
  connect(): Promise<void>;

  /** Gracefully close the connection. */
  disconnect(): Promise<void>;

  /** Send a message to the backend. */
  sendMessage(message: OutgoingMessage): Promise<void>;

  /** Register a callback for incoming messages. */
  onMessage(callback: MessageHandler): void;

  /** Optional: called when connection is established. */
  onConnect?(callback: ConnectHandler): void;

  /** Optional: called when connection is lost. */
  onDisconnect?(callback: DisconnectHandler): void;

  /** Optional: called when the remote peer starts or stops typing. */
  onTyping?(callback: TypingHandler): void;

  /** Optional: send a like/dislike reaction on a bot message to the backend. */
  sendFeedback?(messageId: string, feedback: FeedbackType): Promise<void>;

  /** Optional: upload a file to the backend. */
  sendFile?(file: File, metadata?: Record<string, unknown>): Promise<void>;

  /** Optional: load older messages. Returns a page of history and whether more exist. */
  loadHistory?(cursor?: string): Promise<HistoryResult>;

  /** Optional: register a callback for message delivery/read status updates. */
  onMessageStatus?(callback: MessageStatusHandler): void;

  /** Optional: register a callback for Generative UI streaming chunks. */
  onGenUIChunk?(callback: GenUIChunkHandler): void;

  /**
   * Optional: called by ChatEngine when a GenUI component fires `sendEvent`.
   * @param streamId  Original connector stream id (from `onGenUIChunk`).
   * @param eventType The event type string (e.g. "form_submit").
   * @param payload   Arbitrary payload from the UI component.
   */
  receiveComponentEvent?(streamId: string, eventType: string, payload: unknown): void;
}
