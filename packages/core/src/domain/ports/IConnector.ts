/**
 * IConnector — Port definition for all chat backends.
 *
 * Implement this interface to create a plug-and-play connector
 * (WebSocket, SignalR, DirectLine, REST, etc.)
 *
 * No external dependencies allowed in this file.
 */

import type { IncomingMessage, OutgoingMessage } from "../entities/Message";

export type MessageHandler = (message: IncomingMessage) => void;
export type ConnectHandler = () => void;
export type DisconnectHandler = (reason?: string) => void;
export type TypingHandler = (isTyping: boolean) => void;
export type FeedbackType = "like" | "dislike";

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
}
