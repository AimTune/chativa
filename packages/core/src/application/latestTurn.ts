import type { StoredMessage } from "./stores/MessageStore";

/** The latest exchange of a transcript — what regenerate / edit operate on. */
export interface LatestTurn {
  /** The last user message, or undefined when the user has not written yet. */
  userMessage: StoredMessage | undefined;
  /** Every message after `userMessage` — the bot's reply, possibly several bubbles. */
  reply: StoredMessage[];
}

/**
 * Split off the latest turn: the last user message and the reply after it.
 * With no user message at all, `reply` is empty — a greeting is not a reply
 * that can be regenerated.
 */
export function getLatestTurn(messages: readonly StoredMessage[]): LatestTurn {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].from === "user") {
      return { userMessage: messages[i], reply: messages.slice(i + 1) };
    }
  }
  return { userMessage: undefined, reply: [] };
}

/** True while any message of the reply is still streaming in. */
export function isReplyStreaming(reply: readonly StoredMessage[]): boolean {
  return reply.some(
    (m) =>
      m.data?.streaming === true ||
      (m.type === "genui" && m.data?.streamingComplete === false),
  );
}
