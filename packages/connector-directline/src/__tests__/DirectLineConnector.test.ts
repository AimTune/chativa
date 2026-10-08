import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Activity } from "botframework-directlinejs";
import type { ChativaContext, OutgoingMessage } from "@chativa/core";
import {
  ConnectionStatus,
  FakeDirectLine,
  syncError,
  type FakeSubject,
} from "./_directLineMock";

vi.mock("botframework-directlinejs", async () => {
  const m = await import("./_directLineMock");
  return { DirectLine: m.FakeDirectLine, ConnectionStatus: m.ConnectionStatus };
});

// Imported after vi.mock (hoisted) so the connector picks up the fake SDK.
import { DirectLineConnector, type DirectLineConnectorOptions } from "../DirectLineConnector";

/* ── Fixtures & helpers ─────────────────────────────────────────────── */

const USER = "user-1";
const USER_ID_KEY = "chativa_directline_userId";
const CONVERSATION_KEY = "chativa_directline_conversation";

function botMessage(id: string, text = "hello", extra: Record<string, unknown> = {}): Activity {
  return { type: "message", id, from: { id: "bot" }, text, ...extra } as Activity;
}

function botTyping(id = "t1"): Activity {
  return { type: "typing", id, from: { id: "bot" } } as Activity;
}

function botEvent(name: string, value?: unknown, id = "e1"): Activity {
  return { type: "event", id, name, value, from: { id: "bot" } } as Activity;
}

function echo(id: string, text = "hi"): Activity {
  return { type: "message", id, from: { id: USER }, text } as Activity;
}

function outgoing(id: string, text = "hi"): OutgoingMessage {
  return { id, type: "text", data: { text } } as OutgoingMessage;
}

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}

/** Build an unsigned JWT whose payload carries `exp` (seconds since epoch). */
function jwt(expMs: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(expMs / 1000) }));
  return `header.${payload}.sig`;
}

function makeHandlers(c: DirectLineConnector) {
  const h = {
    message: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    typing: vi.fn(),
    progress: vi.fn(),
    status: vi.fn(),
  };
  c.onMessage(h.message);
  c.onConnect(h.connect);
  c.onDisconnect(h.disconnect);
  c.onTyping(h.typing);
  c.onProgress(h.progress);
  c.onMessageStatus(h.status);
  return h;
}

function makeContext(messages: Array<Record<string, unknown>> = []) {
  const update = vi.fn();
  const ctx = {
    messages: {
      add: vi.fn(),
      update,
      remove: vi.fn(),
      clear: vi.fn(),
      getAll: () => messages,
    },
    chat: {},
    theme: {},
    events: {},
  } as unknown as ChativaContext;
  return { ctx, update };
}

/**
 * Connect with a plain (non-JWT) token, go Online and deliver the welcome
 * message that resolves connect(). Handler mocks are cleared afterwards so
 * each test starts from a clean slate.
 */
async function connected(opts: Partial<DirectLineConnectorOptions> = {}) {
  const c = new DirectLineConnector({ token: "tok", userId: USER, ...opts });
  const h = makeHandlers(c);
  const p = c.connect();
  await vi.waitFor(() => expect(FakeDirectLine.instances.length).toBeGreaterThan(0));
  const dl = FakeDirectLine.last;
  dl.connectionStatus$.next(ConnectionStatus.Online);
  dl.activity$.next(botMessage("welcome", "Welcome!", { conversation: { id: "conv-1" } }));
  await p;
  for (const fn of Object.values(h)) fn.mockClear();
  dl.postActivity.mockClear();
  return { c, h, dl };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  FakeDirectLine.reset();
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ── Read-tick semantics (issue #17 core bullets) ───────────────────── */

describe("message status (read-tick) semantics", () => {
  it('sendMessage emits "sent" synchronously, before postActivity resolves', async () => {
    const { c, h, dl } = await connected();
    let emitNext: (() => void) | undefined;
    dl.postActivity.mockImplementationOnce(
      () =>
        ({
          subscribe: (o: { next: () => void }) => {
            emitNext = o.next;
            return { unsubscribe() {} };
          },
        }) as unknown as FakeSubject<string>,
    );

    let resolved = false;
    const p = c.sendMessage(outgoing("m1")).then(() => (resolved = true));

    // Synchronously after the call: "sent" already emitted, promise still pending.
    expect(h.status).toHaveBeenCalledTimes(1);
    expect(h.status).toHaveBeenCalledWith("m1", "sent");
    await Promise.resolve();
    expect(resolved).toBe(false);

    emitNext!();
    await p;
    expect(resolved).toBe(true);
    // Resolving postActivity does not change the status.
    expect(h.status).toHaveBeenCalledTimes(1);
  });

  it("WebSocket echo of the user's own message does not trigger messageStatusHandler", async () => {
    const { c, h, dl } = await connected();
    await c.sendMessage(outgoing("m1"));
    h.status.mockClear();

    dl.activity$.next(echo("m1"));

    expect(h.status).not.toHaveBeenCalled();
    expect(h.message).not.toHaveBeenCalled();
  });

  it("echo does not consume the pending id — a later bot message still flips it to read", async () => {
    const { c, h, dl } = await connected();
    await c.sendMessage(outgoing("m1"));
    dl.activity$.next(echo("m1"));
    h.status.mockClear();

    dl.activity$.next(botMessage("b1"));

    expect(h.status).toHaveBeenCalledExactlyOnceWith("m1", "read");
  });

  it('first bot message activity flushes every still-pending user id to "read"', async () => {
    const { c, h, dl } = await connected();
    await c.sendMessage(outgoing("m1"));
    h.status.mockClear();

    dl.activity$.next(botMessage("b1"));

    expect(h.status).toHaveBeenCalledExactlyOnceWith("m1", "read");
    // Flush happens before the message is delivered.
    expect(h.status.mock.invocationCallOrder[0]).toBeLessThan(
      h.message.mock.invocationCallOrder[0],
    );
  });

  it('bot typing activity does not flush — pending stays at "sent"', async () => {
    const { c, h, dl } = await connected();
    await c.sendMessage(outgoing("m1"));
    h.status.mockClear();

    dl.activity$.next(botTyping());

    expect(h.status).not.toHaveBeenCalled();
    expect(h.typing).toHaveBeenCalledWith(true);
  });

  it("bot event activity (with name) does not flush", async () => {
    const { c, h, dl } = await connected();
    await c.sendMessage(outgoing("m1"));
    h.status.mockClear();

    dl.activity$.next(botEvent("SomethingHappened", { a: 1 }));
    dl.activity$.next(botEvent("chativa/progress", { stage: "thinking" }));
    dl.activity$.next(botEvent("DisableFeedbackButton", { CorrelationId: "x" }));

    expect(h.status).not.toHaveBeenCalled();
    expect(h.message).not.toHaveBeenCalled();
  });

  it('send → echo → typing → message keeps "sent" then "read" order and never downgrades', async () => {
    const { c, h, dl } = await connected();
    await c.sendMessage(outgoing("m1"));
    dl.activity$.next(echo("m1"));
    dl.activity$.next(botTyping());
    dl.activity$.next(botMessage("b1"));
    dl.activity$.next(botTyping("t2"));
    dl.activity$.next(botMessage("b2"));

    expect(h.status.mock.calls).toEqual([
      ["m1", "sent"],
      ["m1", "read"],
    ]);
    const [sentOrder, readOrder] = h.status.mock.invocationCallOrder;
    expect(sentOrder).toBeLessThan(readOrder);
  });

  it("multiple pending sends are all flushed by a single bot message", async () => {
    const { c, h, dl } = await connected();
    await c.sendMessage(outgoing("m1"));
    await c.sendMessage(outgoing("m2"));
    await c.sendMessage(outgoing("m3"));
    dl.activity$.next(echo("m1"));
    dl.activity$.next(echo("m2"));
    h.status.mockClear();

    dl.activity$.next(botMessage("b1"));

    expect(h.status.mock.calls).toEqual([
      ["m1", "read"],
      ["m2", "read"],
      ["m3", "read"],
    ]);

    h.status.mockClear();
    dl.activity$.next(botMessage("b2"));
    expect(h.status).not.toHaveBeenCalled();
  });

  it("bot activity that maps to nothing (empty message) does not flush", async () => {
    const { c, h, dl } = await connected();
    await c.sendMessage(outgoing("m1"));
    h.status.mockClear();

    dl.activity$.next({ type: "message", id: "b0", from: { id: "bot" } } as Activity);
    dl.activity$.next({ type: "conversationUpdate", id: "b00", from: { id: "bot" } } as unknown as Activity);

    expect(h.status).not.toHaveBeenCalled();
    expect(h.message).not.toHaveBeenCalled();
  });
});

/* ── sendMessage ───────────────────────────────────────────────────── */

describe("sendMessage", () => {
  it("posts a message activity with user, text, conversation, locale and id", async () => {
    const { c, dl } = await connected({ userName: "Alice", locale: "tr-TR" });
    await c.sendMessage(outgoing("m1", "Merhaba"));

    expect(dl.posted[0]).toMatchObject({
      type: "message",
      from: { id: USER, name: "Alice" },
      text: "Merhaba",
      conversation: { id: "conv-1" },
      channelId: "directline",
      locale: "tr-TR",
      id: "m1",
    });
    expect(typeof dl.posted[0].timestamp).toBe("string");
  });

  it("defaults text to empty string and from.name to userId; omits locale when unset", async () => {
    const { c, dl } = await connected();
    await c.sendMessage({ id: "m1", type: "text", data: {} } as OutgoingMessage);

    expect(dl.posted[0].text).toBe("");
    expect(dl.posted[0].from).toEqual({ id: USER, name: USER });
    expect(dl.posted[0]).not.toHaveProperty("locale");
  });

  it("rejects when postActivity errors", async () => {
    const { c, dl } = await connected();
    dl.postActivity.mockImplementationOnce(() => syncError(new Error("boom")));
    await expect(c.sendMessage(outgoing("m1"))).rejects.toThrow("boom");
  });
});

/* ── connect() ─────────────────────────────────────────────────────── */

describe("connect", () => {
  it("exposes name and addSentToHistory", () => {
    const c = new DirectLineConnector({ token: "t" });
    expect(c.name).toBe("directline");
    expect(c.addSentToHistory).toBe(true);
  });

  it("throws when no credential is provided", async () => {
    const c = new DirectLineConnector({});
    await expect(c.connect()).rejects.toThrow(/provide token, secret, or tokenGeneratorUrl/);
  });

  it("creates DirectLine with token + domain, sends webchat/join on Online, resolves on first bot message", async () => {
    const c = new DirectLineConnector({
      token: "tok",
      userId: USER,
      domain: "https://dl.example/v3/directline",
      locale: "en-US",
      joinParameters: { tenant: "acme" },
    });
    const h = makeHandlers(c);
    let done = false;
    const p = c.connect().then(() => (done = true));

    const dl = FakeDirectLine.last;
    expect(dl.options).toEqual({ token: "tok", domain: "https://dl.example/v3/directline" });

    dl.connectionStatus$.next(ConnectionStatus.Online);
    expect(dl.posted[0]).toEqual({
      type: "event",
      name: "webchat/join",
      from: { id: USER, name: USER },
      locale: "en-US",
      value: { language: "en-US", tenant: "acme" },
    });

    // Fresh conversations do not resolve on Online alone.
    await Promise.resolve();
    expect(done).toBe(false);
    expect(h.connect).not.toHaveBeenCalled();

    // Typing doesn't resolve either.
    dl.activity$.next(botTyping());
    await Promise.resolve();
    expect(done).toBe(false);

    dl.activity$.next(botMessage("welcome"));
    await p;
    expect(h.connect).toHaveBeenCalledTimes(1);
    expect(h.message).toHaveBeenCalledWith(
      expect.objectContaining({ id: "welcome", type: "text", from: "bot" }),
    );
  });

  it("join event omits locale fields when no locale is configured", async () => {
    const { dl } = await connected();
    // postActivity was cleared by connected(); go Online again to inspect the join.
    dl.connectionStatus$.next(ConnectionStatus.Online);
    expect(dl.posted[0]).toEqual({
      type: "event",
      name: "webchat/join",
      from: { id: USER, name: USER },
      value: {},
    });
  });

  it("fetches a token using the secret", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "gen-tok", conversationId: "conv-s" }));
    const c = new DirectLineConnector({ secret: "s3cret", userId: USER });
    makeHandlers(c);
    const p = c.connect();
    await vi.waitFor(() => expect(FakeDirectLine.instances).toHaveLength(1));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://directline.botframework.com/v3/directline/tokens/generate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer s3cret" }),
        body: JSON.stringify({ user: { id: USER, name: USER } }),
      }),
    );
    expect(FakeDirectLine.last.options.token).toBe("gen-tok");

    FakeDirectLine.last.activity$.next(botMessage("w"));
    await p;
    await c.sendMessage(outgoing("m1"));
    expect(FakeDirectLine.last.posted.at(-1)!.conversation).toEqual({ id: "conv-s" });
  });

  it("rejects when the secret token fetch fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 403));
    const c = new DirectLineConnector({ secret: "bad" });
    await expect(c.connect()).rejects.toThrow("DirectLine token fetch failed: 403");
  });

  it("fetches a token from tokenGeneratorUrl and adopts returned userId / conversationId", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: "url-tok", conversationId: "conv-u", userId: "server-user" }),
    );
    const c = new DirectLineConnector({ tokenGeneratorUrl: "https://tok.example/gen", userId: USER });
    const p = c.connect();
    await vi.waitFor(() => expect(FakeDirectLine.instances).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith("https://tok.example/gen", { method: "POST" });
    expect(FakeDirectLine.last.options.token).toBe("url-tok");

    FakeDirectLine.last.connectionStatus$.next(ConnectionStatus.Online);
    expect(FakeDirectLine.last.posted[0].from).toEqual({ id: "server-user", name: "server-user" });

    FakeDirectLine.last.activity$.next(botMessage("w"));
    await p;
    await c.sendMessage(outgoing("m1"));
    expect(FakeDirectLine.last.posted.at(-1)!.conversation).toEqual({ id: "conv-u" });
  });

  it("tokenGeneratorUrl without conversationId/userId keeps defaults", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "url-tok" }));
    const c = new DirectLineConnector({ tokenGeneratorUrl: "https://tok.example/gen", userId: USER });
    const p = c.connect();
    await vi.waitFor(() => expect(FakeDirectLine.instances).toHaveLength(1));
    FakeDirectLine.last.connectionStatus$.next(ConnectionStatus.Online);
    expect(FakeDirectLine.last.posted[0].from).toEqual({ id: USER, name: USER });
    FakeDirectLine.last.activity$.next(botMessage("w"));
    await p;
  });

  it("rejects when tokenGeneratorUrl fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500));
    const c = new DirectLineConnector({ tokenGeneratorUrl: "https://tok.example/gen" });
    await expect(c.connect()).rejects.toThrow("Token generator failed: 500");
  });

  it("captures conversationId from the first activity when the token didn't carry one", async () => {
    const { c, dl } = await connected(); // welcome activity carried conversation conv-1
    dl.activity$.next(botMessage("b2", "x", { conversation: { id: "other" } }));
    await c.sendMessage(outgoing("m1"));
    expect(dl.posted.at(-1)!.conversation).toEqual({ id: "conv-1" });
  });

  it("generates a random, non-persisted userId when none is given", async () => {
    const c = new DirectLineConnector({ token: "tok" });
    const p = c.connect();
    const dl = FakeDirectLine.last;
    dl.connectionStatus$.next(ConnectionStatus.Online);
    const id = (dl.posted[0].from as { id: string }).id;
    expect(id).toMatch(/^[a-z0-9]+$/);
    expect(localStorage.getItem(USER_ID_KEY)).toBeNull();
    dl.activity$.next(botMessage("w"));
    await p;
  });

  it("persists and reuses the generated userId in resumeConversation mode", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const c = new DirectLineConnector({ token: "tok", resumeConversation: true });
      const p = c.connect();
      await vi.waitFor(() => expect(FakeDirectLine.instances).toHaveLength(i + 1));
      const dl = FakeDirectLine.last;
      dl.connectionStatus$.next(ConnectionStatus.Online);
      ids.push((dl.posted[0].from as { id: string }).id);
      dl.activity$.next(botMessage("w"));
      await p;
    }
    expect(ids[0]).toBe(ids[1]);
    expect(localStorage.getItem(USER_ID_KEY)).toBe(ids[0]);
  });
});

/* ── Connection status ─────────────────────────────────────────────── */

describe("connection status handling", () => {
  it("FailedToConnect calls the disconnect handler", async () => {
    const { h, dl } = await connected();
    dl.connectionStatus$.next(ConnectionStatus.FailedToConnect);
    expect(h.disconnect).toHaveBeenCalledWith("Failed to connect");
  });

  it("FailedToConnect clears persisted conversation in resume mode", async () => {
    const { h, dl } = await connected({ resumeConversation: true });
    expect(localStorage.getItem(CONVERSATION_KEY)).not.toBeNull();
    dl.connectionStatus$.next(ConnectionStatus.FailedToConnect);
    expect(localStorage.getItem(CONVERSATION_KEY)).toBeNull();
    expect(h.disconnect).toHaveBeenCalledWith("Failed to connect");
  });

  it("Ended calls the disconnect handler", async () => {
    const { h, dl } = await connected();
    dl.connectionStatus$.next(ConnectionStatus.Ended);
    expect(h.disconnect).toHaveBeenCalledWith("Connection ended");
  });

  it("ExpiredToken refreshes the token and recreates DirectLine on the same conversation", async () => {
    const { c, h, dl } = await connected({ domain: "https://dl.example/v3" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "new-tok", conversationId: "conv-1" }));

    dl.connectionStatus$.next(ConnectionStatus.ExpiredToken);
    await vi.waitFor(() => expect(FakeDirectLine.instances).toHaveLength(2));

    expect(fetchMock).toHaveBeenCalledWith("https://dl.example/v3/tokens/refresh", {
      method: "POST",
      headers: { Authorization: "Bearer tok" },
    });
    expect(dl.end).toHaveBeenCalled();
    expect(dl.activity$.observerCount).toBe(0);
    expect(dl.connectionStatus$.observerCount).toBe(0);

    const dl2 = FakeDirectLine.last;
    expect(dl2.options).toEqual({
      token: "new-tok",
      domain: "https://dl.example/v3",
      conversationId: "conv-1",
      watermark: "welcome",
    });

    // New instance is live: bot messages flow through.
    dl2.activity$.next(botMessage("after"));
    expect(h.message).toHaveBeenCalledWith(expect.objectContaining({ id: "after" }));
    await c.disconnect();
  });

  it("ExpiredToken tolerates end() throwing on the old instance and persists in resume mode", async () => {
    const { dl } = await connected({ resumeConversation: true });
    dl.end.mockImplementation(() => {
      throw new Error("already ended");
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "new-tok" }));
    dl.connectionStatus$.next(ConnectionStatus.ExpiredToken);
    await vi.waitFor(() => expect(FakeDirectLine.instances).toHaveLength(2));
    expect(JSON.parse(localStorage.getItem(CONVERSATION_KEY)!).token).toBe("new-tok");
  });

  it("ExpiredToken with failing refresh disconnects and clears persisted state", async () => {
    const { h, dl } = await connected({ resumeConversation: true });
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 401));
    dl.connectionStatus$.next(ConnectionStatus.ExpiredToken);
    await vi.waitFor(() =>
      expect(h.disconnect).toHaveBeenCalledWith("Token expired and refresh failed"),
    );
    expect(localStorage.getItem(CONVERSATION_KEY)).toBeNull();
    expect(FakeDirectLine.instances).toHaveLength(1);
  });

  it("ExpiredToken refresh failure without resume mode just disconnects", async () => {
    const { h, dl } = await connected();
    fetchMock.mockRejectedValueOnce(new Error("network"));
    dl.connectionStatus$.next(ConnectionStatus.ExpiredToken);
    await vi.waitFor(() =>
      expect(h.disconnect).toHaveBeenCalledWith("Token expired and refresh failed"),
    );
  });

  it("ignores other statuses (Connecting)", async () => {
    const { h, dl } = await connected();
    dl.connectionStatus$.next(ConnectionStatus.Connecting);
    expect(h.disconnect).not.toHaveBeenCalled();
    expect(dl.postActivity).not.toHaveBeenCalled();
  });
});

/* ── Conversation resume ───────────────────────────────────────────── */

describe("conversation resume", () => {
  const persisted = {
    conversationId: "conv-old",
    token: "old-tok",
    watermark: "42",
    userId: "persisted-user",
  };

  it("refreshes the persisted token, rejoins, and resolves on Online", async () => {
    localStorage.setItem(CONVERSATION_KEY, JSON.stringify(persisted));
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "refreshed", conversationId: "conv-old" }));

    const c = new DirectLineConnector({ token: "unused", resumeConversation: true, locale: "de-DE" });
    const h = makeHandlers(c);
    const p = c.connect();
    await vi.waitFor(() => expect(FakeDirectLine.instances).toHaveLength(1));
    const dl = FakeDirectLine.last;

    expect(fetchMock).toHaveBeenCalledWith(
      "https://directline.botframework.com/v3/directline/tokens/refresh",
      expect.objectContaining({ headers: { Authorization: "Bearer old-tok" } }),
    );
    expect(dl.options).toEqual({
      token: "refreshed",
      domain: undefined,
      conversationId: "conv-old",
      watermark: "42",
    });

    dl.connectionStatus$.next(ConnectionStatus.Online);
    await p;

    expect(h.connect).toHaveBeenCalledTimes(1);
    expect(dl.posted[0]).toEqual({
      type: "event",
      name: "webchat/rejoin",
      from: { id: "persisted-user", name: "persisted-user" },
      locale: "de-DE",
      value: { language: "de-DE" },
    });
    expect(JSON.parse(localStorage.getItem(CONVERSATION_KEY)!)).toEqual({
      ...persisted,
      token: "refreshed",
    });

    // A later Online (reconnect) sends a normal join, not rejoin.
    dl.connectionStatus$.next(ConnectionStatus.Online);
    expect(dl.posted[1].name).toBe("webchat/join");
  });

  it("rejoin without locale sends empty value", async () => {
    localStorage.setItem(CONVERSATION_KEY, JSON.stringify(persisted));
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "refreshed" }));
    const c = new DirectLineConnector({ token: "unused", resumeConversation: true });
    const p = c.connect();
    await vi.waitFor(() => expect(FakeDirectLine.instances).toHaveLength(1));
    FakeDirectLine.last.connectionStatus$.next(ConnectionStatus.Online);
    await p;
    expect(FakeDirectLine.last.posted[0]).toEqual({
      type: "event",
      name: "webchat/rejoin",
      from: { id: "persisted-user", name: "persisted-user" },
      value: {},
    });
  });

  it("falls back to a fresh conversation when the persisted token can't be refreshed", async () => {
    localStorage.setItem(CONVERSATION_KEY, JSON.stringify(persisted));
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 403));

    const c = new DirectLineConnector({ token: "fresh", userId: USER, resumeConversation: true });
    const p = c.connect();
    await vi.waitFor(() => expect(FakeDirectLine.instances).toHaveLength(1));
    const dl = FakeDirectLine.last;
    expect(localStorage.getItem(CONVERSATION_KEY)).toBeNull();
    expect(dl.options).toEqual({ token: "fresh", domain: undefined });

    dl.connectionStatus$.next(ConnectionStatus.Online);
    expect(dl.posted[0].name).toBe("webchat/join");
    dl.activity$.next(botMessage("w1", "hey", { conversation: { id: "conv-new" } }));
    await p;

    expect(JSON.parse(localStorage.getItem(CONVERSATION_KEY)!)).toEqual({
      conversationId: "conv-new",
      token: "fresh",
      watermark: "w1",
      userId: USER,
    });
  });

  it("ignores corrupt persisted JSON", async () => {
    localStorage.setItem(CONVERSATION_KEY, "{not json");
    const { dl } = await connected({ resumeConversation: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dl.options).toEqual({ token: "tok", domain: undefined });
  });

  it("updates the persisted watermark after each bot message", async () => {
    const { dl } = await connected({ resumeConversation: true });
    dl.activity$.next(botMessage("w9"));
    expect(JSON.parse(localStorage.getItem(CONVERSATION_KEY)!).watermark).toBe("w9");
  });

  it("clearConversation removes persisted state", async () => {
    const { c } = await connected({ resumeConversation: true });
    expect(localStorage.getItem(CONVERSATION_KEY)).not.toBeNull();
    c.clearConversation();
    expect(localStorage.getItem(CONVERSATION_KEY)).toBeNull();
  });
});

/* ── Token refresh scheduling ──────────────────────────────────────── */

describe("scheduled token refresh", () => {
  it("refreshes 60s before JWT expiry and reschedules with the new token", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const now = Date.now();
    const token = jwt(now + 120_000); // refresh due in 60s
    const next = jwt(now + 60_000 + 3_600_000);
    fetchMock.mockResolvedValue(jsonResponse({ token: next }));

    const { c } = await connected({ token, resumeConversation: true });
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(59_000);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://directline.botframework.com/v3/directline/tokens/refresh",
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    );
    expect(JSON.parse(localStorage.getItem(CONVERSATION_KEY)!).token).toBe(next);

    // Rescheduled ~1h later; disconnect cancels it.
    await c.disconnect();
    await vi.advanceTimersByTimeAsync(4_000_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes immediately when the token is already about to expire", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ token: "plain" }));
    const c = new DirectLineConnector({ token: jwt(Date.now() + 30_000), userId: USER });
    void c.connect();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/tokens\/refresh$/);
  });

  it("logs a warning when the scheduled refresh fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(jsonResponse({}, false, 500));
    const c = new DirectLineConnector({ token: jwt(Date.now() + 1_000), userId: USER });
    void c.connect();
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        "[DirectLineConnector] Token refresh failed:",
        expect.any(Error),
      ),
    );
  });

  it("does not schedule a refresh for a JWT without exp", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const token = `h.${btoa(JSON.stringify({ sub: "x" }))}.s`;
    await connected({ token });
    await vi.advanceTimersByTimeAsync(10_000_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/* ── Typing & progress ─────────────────────────────────────────────── */

describe("onTyping", () => {
  it("shows typing and auto-clears after the default 3000ms", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { h, dl } = await connected();
    dl.activity$.next(botTyping());
    expect(h.typing).toHaveBeenLastCalledWith(true);

    vi.advanceTimersByTime(2_999);
    expect(h.typing).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(h.typing).toHaveBeenLastCalledWith(false);
  });

  it("honours typingTimeoutMs and resets the timer on each typing signal", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { h, dl } = await connected({ typingTimeoutMs: 1_000 });
    dl.activity$.next(botTyping("t1"));
    vi.advanceTimersByTime(800);
    dl.activity$.next(botTyping("t2"));
    vi.advanceTimersByTime(800);
    expect(h.typing.mock.calls).toEqual([[true], [true]]);
    vi.advanceTimersByTime(200);
    expect(h.typing.mock.calls).toEqual([[true], [true], [false]]);
  });

  it("typingUntilMessage keeps typing on until the next bot message", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { h, dl } = await connected({ typingUntilMessage: true });
    dl.activity$.next(botTyping());
    vi.advanceTimersByTime(60_000);
    expect(h.typing.mock.calls).toEqual([[true]]);

    dl.activity$.next(botMessage("b1"));
    expect(h.typing.mock.calls).toEqual([[true], [false]]);
  });

  it("a bot message clears typing and cancels the pending auto-clear", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { h, dl } = await connected();
    dl.activity$.next(botTyping());
    dl.activity$.next(botMessage("b1"));
    expect(h.typing.mock.calls).toEqual([[true], [false]]);
    expect(h.typing.mock.invocationCallOrder[1]).toBeLessThan(h.message.mock.invocationCallOrder[0]);
    vi.advanceTimersByTime(10_000);
    expect(h.typing).toHaveBeenCalledTimes(2);
  });
});

describe("onProgress (chativa/progress event)", () => {
  it("forwards stage + message and turns typing on", async () => {
    const { h, dl } = await connected();
    dl.activity$.next(botEvent("chativa/progress", { stage: "search", message: "Searching…" }));
    expect(h.typing).toHaveBeenCalledWith(true);
    expect(h.progress).toHaveBeenCalledWith({ stage: "search", message: "Searching…" });
    expect(h.typing.mock.invocationCallOrder[0]).toBeLessThan(h.progress.mock.invocationCallOrder[0]);
    expect(h.message).not.toHaveBeenCalled();
  });

  it("forwards stage only", async () => {
    const { h, dl } = await connected();
    dl.activity$.next(botEvent("chativa/progress", { stage: "thinking" }));
    expect(h.progress).toHaveBeenCalledWith({ stage: "thinking" });
  });

  it("forwards message only", async () => {
    const { h, dl } = await connected();
    dl.activity$.next(botEvent("chativa/progress", { message: "Hang on" }));
    expect(h.progress).toHaveBeenCalledWith({ message: "Hang on" });
  });

  it("drops a whitespace-only message but keeps a valid stage", async () => {
    const { h, dl } = await connected();
    dl.activity$.next(botEvent("chativa/progress", { stage: "s", message: "   " }));
    expect(h.progress).toHaveBeenCalledWith({ stage: "s" });
  });

  it.each([
    ["no value", undefined],
    ["empty object", {}],
    ["whitespace message only", { message: "  " }],
    ["non-string fields", { stage: 1, message: 2 }],
  ])("ignores invalid payloads (%s)", async (_label, value) => {
    const { h, dl } = await connected();
    dl.activity$.next(botEvent("chativa/progress", value));
    expect(h.progress).not.toHaveBeenCalled();
    expect(h.typing).not.toHaveBeenCalled();
  });

  it("is not dispatched to a custom handler of the same name", async () => {
    const custom = vi.fn();
    const { h, dl } = await connected({ eventHandlers: { "chativa/progress": custom } });
    dl.activity$.next(botEvent("chativa/progress", { stage: "x" }));
    expect(h.progress).toHaveBeenCalled();
    expect(custom).not.toHaveBeenCalled();
  });
});

/* ── Feedback ──────────────────────────────────────────────────────── */

describe("sendFeedback", () => {
  const stored = [
    { id: "bot-1", type: "text", from: "bot", data: { text: "a", channelData: { correlationId: "corr-1" } } },
    { id: "bot-2", type: "text", from: "bot", data: { text: "b" } },
  ];

  it.each([
    ["like", 0],
    ["dislike", 1],
  ] as const)("posts webchat/messageFeedback for %s with feedbackType %i", async (fb, type) => {
    const { c, dl } = await connected();
    c.setContext(makeContext(stored).ctx);
    await c.sendFeedback("bot-1", fb);
    expect(dl.posted[0]).toEqual({
      type: "event",
      name: "webchat/messageFeedback",
      from: { id: USER, name: USER },
      value: { correlationId: "corr-1", feedbackType: type },
    });
  });

  it("warns and posts nothing when the message has no correlationId", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { c, dl } = await connected();
    c.setContext(makeContext(stored).ctx);
    await c.sendFeedback("bot-2", "like");
    await c.sendFeedback("missing", "like");
    expect(dl.postActivity).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "[DirectLineConnector] sendFeedback: no correlationId found for message",
      "bot-2",
    );
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("warns when no context has been injected", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { c, dl } = await connected();
    await c.sendFeedback("bot-1", "like");
    expect(dl.postActivity).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("rejects when postActivity errors", async () => {
    const { c, dl } = await connected();
    c.setContext(makeContext(stored).ctx);
    dl.postActivity.mockImplementationOnce(() => syncError(new Error("nope")));
    await expect(c.sendFeedback("bot-1", "like")).rejects.toThrow("nope");
  });
});

describe("DisableFeedbackButton event", () => {
  const stored = [
    { id: "bot-1", type: "text", from: "bot", data: { text: "a", channelData: { correlationId: "corr-1" } } },
  ];

  it("patches the matching message with feedbackDisabled + feedbackType", async () => {
    const { c, dl } = await connected();
    const { ctx, update } = makeContext(stored);
    c.setContext(ctx);
    dl.activity$.next(botEvent("DisableFeedbackButton", { CorrelationId: "corr-1", FeedbackType: 1 }));
    expect(update).toHaveBeenCalledExactlyOnceWith("bot-1", {
      data: { text: "a", channelData: { correlationId: "corr-1" }, feedbackDisabled: true, feedbackType: 1 },
    });
  });

  it("does nothing for an unknown correlationId or a missing CorrelationId", async () => {
    const { c, dl } = await connected();
    const { ctx, update } = makeContext(stored);
    c.setContext(ctx);
    dl.activity$.next(botEvent("DisableFeedbackButton", { CorrelationId: "other" }));
    dl.activity$.next(botEvent("DisableFeedbackButton", { FeedbackType: 0 }));
    dl.activity$.next(botEvent("DisableFeedbackButton"));
    expect(update).not.toHaveBeenCalled();
  });

  it("is a no-op without a context", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { dl } = await connected();
    dl.activity$.next(botEvent("DisableFeedbackButton", { CorrelationId: "corr-1" }));
    expect(warn).not.toHaveBeenCalled();
  });

  it("still dispatches to a custom DisableFeedbackButton handler", async () => {
    const custom = vi.fn();
    const { c, dl } = await connected({ eventHandlers: { DisableFeedbackButton: custom } });
    const { ctx, update } = makeContext(stored);
    c.setContext(ctx);
    dl.activity$.next(botEvent("DisableFeedbackButton", { CorrelationId: "corr-1" }));
    expect(update).toHaveBeenCalled();
    expect(custom).toHaveBeenCalledTimes(1);
  });
});

/* ── Custom event handlers ─────────────────────────────────────────── */

describe("custom event handlers", () => {
  it("dispatches bot events with a context that can post events back", async () => {
    const handler = vi.fn();
    const { c, dl } = await connected({
      userName: "Alice",
      locale: "fr-FR",
      eventHandlers: { LocationRequest: handler },
    });
    const { ctx } = makeContext();
    c.setContext(ctx);
    const activity = botEvent("LocationRequest", { why: "weather" });
    dl.activity$.next(activity);

    expect(handler).toHaveBeenCalledTimes(1);
    const ectx = handler.mock.calls[0][0];
    expect(ectx.activity).toBe(activity);
    expect(ectx.userId).toBe(USER);
    expect(ectx.userName).toBe("Alice");
    expect(ectx.chativa).toBe(ctx);

    ectx.postEvent("webchat/location", { lat: 1 });
    expect(dl.posted[0]).toEqual({
      type: "event",
      name: "webchat/location",
      from: { id: USER, name: "Alice" },
      locale: "fr-FR",
      value: { lat: 1 },
    });
  });

  it("postEvent omits locale when unset and userName falls back to userId", async () => {
    const handler = vi.fn();
    const { dl } = await connected({ eventHandlers: { Ping: handler } });
    dl.activity$.next(botEvent("Ping"));
    const ectx = handler.mock.calls[0][0];
    expect(ectx.userName).toBe(USER);
    ectx.postEvent("Pong");
    expect(dl.posted[0]).toEqual({
      type: "event",
      name: "Pong",
      from: { id: USER, name: USER },
      value: undefined,
    });
  });

  it("add / has / remove / getEventHandlerNames manage the registry", async () => {
    const c = new DirectLineConnector({ token: "t" });
    expect(c.getEventHandlerNames()).toEqual([]);
    expect(c.hasEventHandler("A")).toBe(false);
    expect(c.removeEventHandler("A")).toBe(false);

    const a = vi.fn();
    c.addEventHandler("A", a);
    c.addEventHandler("B", vi.fn());
    expect(c.hasEventHandler("A")).toBe(true);
    expect(c.getEventHandlerNames()).toEqual(["A", "B"]);
    expect(c.removeEventHandler("A")).toBe(true);
    expect(c.getEventHandlerNames()).toEqual(["B"]);
  });

  it("handlers added after connect are honoured; unknown events are ignored", async () => {
    const { c, h, dl } = await connected();
    dl.activity$.next(botEvent("Late"));
    const late = vi.fn();
    c.addEventHandler("Late", late);
    dl.activity$.next(botEvent("Late"));
    expect(late).toHaveBeenCalledTimes(1);
    expect(h.message).not.toHaveBeenCalled();
  });

  it("an event without a name falls through to mapping and is ignored", async () => {
    const { h, dl } = await connected();
    dl.activity$.next({ type: "event", id: "e", from: { id: "bot" } } as Activity);
    expect(h.message).not.toHaveBeenCalled();
  });

  it("errors thrown inside activity processing are caught and logged", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { dl } = await connected({
      eventHandlers: {
        Boom: () => {
          throw new Error("handler failed");
        },
      },
    });
    expect(() => dl.activity$.next(botEvent("Boom"))).not.toThrow();
    expect(warn).toHaveBeenCalledWith("[DirectLineConnector] Activity mapping error:", expect.any(Error));
  });
});

/* ── Survey ────────────────────────────────────────────────────────── */

describe("sendSurvey", () => {
  it.each([
    [{ rating: 5, comment: "great", kind: 2 }, { rating: 5, comment: "great", type: 2 }],
    [{ rating: 4, kind: "3" }, { rating: 4, comment: "", type: 3 }],
    [{ rating: 3 }, { rating: 3, comment: "", type: 1 }],
    [{ rating: 2, kind: "csat" }, { rating: 2, comment: "", type: 1 }],
  ])("posts webchat/customerfeedback (%o)", async (payload, value) => {
    const { c, dl } = await connected();
    await c.sendSurvey(payload as never);
    expect(dl.posted[0]).toEqual({
      type: "event",
      name: "webchat/customerfeedback",
      from: { id: USER, name: USER },
      value,
    });
  });

  it("rejects when postActivity errors", async () => {
    const { c, dl } = await connected();
    dl.postActivity.mockImplementationOnce(() => syncError(new Error("x")));
    await expect(c.sendSurvey({ rating: 1 } as never)).rejects.toThrow("x");
  });
});

/* ── REST helpers: sendFile & loadHistory ──────────────────────────── */

describe("sendFile", () => {
  it("uploads via the conversation upload endpoint", async () => {
    const { c } = await connected({ userId: "u 1" });
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const file = new File(["abc"], "a.txt", { type: "text/plain" });
    await c.sendFile(file);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://directline.botframework.com/v3/directline/conversations/conv-1/upload?userId=u%201",
    );
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer tok" });
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("uses the custom domain and throws on failure", async () => {
    const { c } = await connected({ domain: "https://gov.example/v3" });
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 413));
    await expect(c.sendFile(new File(["x"], "x.bin"))).rejects.toThrow(
      "DirectLine file upload failed: 413",
    );
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/gov\.example\/v3\/conversations\//);
  });
});

describe("loadHistory", () => {
  it("maps user and bot activities and returns the watermark as cursor", async () => {
    const { c } = await connected();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        watermark: "7",
        activities: [
          { type: "message", id: "u1", from: { id: USER }, text: "hi", timestamp: "2024-01-01T00:00:00Z" },
          { type: "message", id: "u2", from: { id: USER } }, // no text → skipped
          { type: "message", from: { id: USER }, text: "no id" },
          { type: "typing", id: "t", from: { id: "bot" } },
          { type: "message", id: "b1", from: { id: "bot" }, text: "hello" },
          { type: "event", id: "e", name: "x", from: { id: "bot" } },
        ],
      }),
    );

    const res = await c.loadHistory();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://directline.botframework.com/v3/directline/conversations/conv-1/activities",
      { headers: { Authorization: "Bearer tok" } },
    );
    expect(res.hasMore).toBe(false);
    expect(res.cursor).toBe("7");
    expect(res.messages).toHaveLength(3);
    expect(res.messages[0]).toEqual({
      id: "u1",
      type: "text",
      from: "user",
      data: { text: "hi" },
      timestamp: Date.parse("2024-01-01T00:00:00Z"),
    });
    expect(res.messages[1]).toMatchObject({ from: "user", data: { text: "no id" } });
    expect(res.messages[1].id).toMatch(/^dl-/);
    expect(res.messages[2]).toMatchObject({ id: "b1", from: "bot", type: "text" });
  });

  it("passes the cursor as an encoded watermark", async () => {
    const { c } = await connected({ domain: "https://d.example" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ watermark: "9", activities: [] }));
    await c.loadHistory("a&b");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://d.example/conversations/conv-1/activities?watermark=a%26b",
    );
  });

  it("throws on a failed fetch", async () => {
    const { c } = await connected();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 404));
    await expect(c.loadHistory()).rejects.toThrow("DirectLine history fetch failed: 404");
  });
});

/* ── disconnect ────────────────────────────────────────────────────── */

describe("disconnect", () => {
  it("unsubscribes, ends DirectLine and clears pending typing timers", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { c, h, dl } = await connected();
    dl.activity$.next(botTyping());
    h.typing.mockClear();

    await c.disconnect();

    expect(dl.end).toHaveBeenCalledTimes(1);
    expect(dl.activity$.observerCount).toBe(0);
    expect(dl.connectionStatus$.observerCount).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(h.typing).not.toHaveBeenCalled();
  });

  it("drops the message-status handler so later sends don't report status", async () => {
    const { c, h } = await connected();
    await c.disconnect();
    await c.sendMessage(outgoing("m1"));
    expect(h.status).not.toHaveBeenCalled();
  });

  it("swallows errors from DirectLine.end() and is safe before connect", async () => {
    const { c, dl } = await connected();
    dl.end.mockImplementation(() => {
      throw new Error("already ended");
    });
    await expect(c.disconnect()).resolves.toBeUndefined();
    await expect(new DirectLineConnector({ token: "t" }).disconnect()).resolves.toBeUndefined();
  });
});
