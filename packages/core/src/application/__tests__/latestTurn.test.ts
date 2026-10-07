import { describe, it, expect } from "vitest";
import { getLatestTurn, isReplyStreaming } from "../latestTurn";
import type { StoredMessage } from "../stores/MessageStore";

const msg = (id: string, from: "bot" | "user", data: Record<string, unknown> = {}, type = "text"): StoredMessage => ({
  id,
  type,
  from,
  data,
});

describe("getLatestTurn", () => {
  it("returns the last user message and everything after it", () => {
    const messages = [msg("b0", "bot"), msg("u1", "user"), msg("b1", "bot"), msg("u2", "user"), msg("b2", "bot"), msg("b3", "bot")];
    const turn = getLatestTurn(messages);
    expect(turn.userMessage?.id).toBe("u2");
    expect(turn.reply.map((m) => m.id)).toEqual(["b2", "b3"]);
  });

  it("has an empty reply while the user's message is still unanswered", () => {
    const turn = getLatestTurn([msg("u1", "user")]);
    expect(turn.userMessage?.id).toBe("u1");
    expect(turn.reply).toEqual([]);
  });

  it("has no user message and no reply for a bot-only transcript", () => {
    expect(getLatestTurn([msg("g", "bot")])).toEqual({ userMessage: undefined, reply: [] });
    expect(getLatestTurn([])).toEqual({ userMessage: undefined, reply: [] });
  });
});

describe("isReplyStreaming", () => {
  it("detects a streaming text bubble or an open GenUI stream", () => {
    expect(isReplyStreaming([msg("b", "bot", { streaming: true })])).toBe(true);
    expect(isReplyStreaming([msg("g", "bot", { streamingComplete: false }, "genui")])).toBe(true);
  });

  it("is false for settled replies", () => {
    expect(isReplyStreaming([msg("b", "bot", { streaming: false })])).toBe(false);
    expect(isReplyStreaming([msg("g", "bot", { streamingComplete: true }, "genui")])).toBe(false);
    expect(isReplyStreaming([])).toBe(false);
  });
});
