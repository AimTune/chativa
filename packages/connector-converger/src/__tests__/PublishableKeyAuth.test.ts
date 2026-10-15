import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PublishableKeyAuth, ConvergerApiError } from "../index";
import type { MekikAuthContext } from "../index";

// ── Test doubles ───────────────────────────────────────────────────────

/** In-memory `Storage`. */
class MemoryStorage implements Storage {
  readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

/** A `Storage` whose every access throws (Safari private mode, blocked site data). */
class BrokenStorage extends MemoryStorage {
  override getItem(): string | null {
    throw new Error("SecurityError");
  }
  override setItem(): void {
    throw new Error("QuotaExceededError");
  }
  override removeItem(): void {
    throw new Error("SecurityError");
  }
}

interface Call {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** Answers each exchange with the next response (or response factory). */
function mockExchange(...answers: Array<Response | ((call: Call) => Response)>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
    const call: Call = {
      url: String(input),
      headers: new Headers(init.headers),
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
    };
    calls.push(call);
    const answer = answers.shift() ?? json({ error: { code: "unexpected" } }, 500);
    return typeof answer === "function" ? answer(call) : answer;
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

const KEY = "cvg_pk_test";
const STORAGE_KEY = `chativa:converger:pk:${KEY}`;

const session = (extra: Record<string, unknown> = {}) =>
  json({
    conversationId: "conv-1",
    token: "tok-1",
    expires_in: 1800,
    userId: "anon_1",
    resume: "res-1",
    resumed: false,
    ...extra,
  });

const CTX: MekikAuthContext = { url: "ws://hub.test/socket/converger/v1", attempt: 0, previousError: null };

function make(storage: Storage | null = new MemoryStorage(), extra: Record<string, unknown> = {}) {
  return new PublishableKeyAuth({ baseUrl: "http://hub.test/", publishableKey: KEY, storage, ...extra });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Exchange ───────────────────────────────────────────────────────────

describe("PublishableKeyAuth — exchange", () => {
  it("posts the key without resume on a first visit and returns a bound credential", async () => {
    const { calls } = mockExchange(session());
    const storage = new MemoryStorage();
    const auth = make(storage);
    expect(auth.name).toBe("publishable-key");
    expect(auth.conversationBound).toBe(true);
    expect(auth.conversationId).toBeUndefined();

    const credential = await auth.authenticate(CTX);
    expect(credential).toEqual({ token: "tok-1", conversationId: "conv-1", userId: "anon_1" });
    expect(calls[0].url).toBe("http://hub.test/api/v1/converger/tokens/publishable");
    expect(calls[0].headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(calls[0].headers.get("content-type")).toBe("application/json");
    expect(calls[0].body).toEqual({});
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual({
      resume: "res-1",
      conversationId: "conv-1",
      userId: "anon_1",
    });
    expect(auth.conversationId).toBe("conv-1");
  });

  it("accepts the client API base as baseUrl", async () => {
    const { calls } = mockExchange(session());
    await new PublishableKeyAuth({
      baseUrl: "https://hub.test/api/v1/converger/",
      publishableKey: ` ${KEY} `,
      storage: null,
    }).session();
    expect(calls[0].url).toBe("https://hub.test/api/v1/converger/tokens/publishable");
    expect(calls[0].headers.get("authorization")).toBe(`Bearer ${KEY}`);
  });

  it("reuses a stored resume after a reload and keeps the conversation", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ resume: "res-0", conversationId: "conv-1", userId: "anon_1" }));
    const { calls } = mockExchange(session({ resume: "res-2", resumed: true }));
    const auth = make(storage);
    expect(auth.conversationId).toBe("conv-1");

    const s = await auth.session();
    expect(calls[0].body).toEqual({ resume: "res-0" });
    expect(s.resumed).toBe(true);
    expect(s.conversationId).toBe("conv-1");
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).resume).toBe("res-2");
  });

  it("keeps the old resume when a resumed answer carries none", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ resume: "res-0", conversationId: "conv-1" }));
    mockExchange(session({ resume: undefined, resumed: true, userId: undefined }));
    const auth = make(storage);
    const credential = await auth.authenticate(CTX);
    expect(credential).toEqual({ token: "tok-1", conversationId: "conv-1" });
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual({ resume: "res-0", conversationId: "conv-1" });
  });

  it("replaces the stored conversation when Converger starts a new one", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ resume: "stale", conversationId: "conv-old", userId: "anon_old" }));
    const { calls } = mockExchange(session({ conversationId: "conv-new", resume: undefined, resumed: false }));
    const auth = make(storage);
    const s = await auth.session();
    expect(calls[0].body).toEqual({ resume: "stale" });
    expect(s).toMatchObject({ conversationId: "conv-new", resumed: false });
    // The stale resume belongs to the old conversation: it is not kept.
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual({ conversationId: "conv-new", userId: "anon_1" });
    expect(auth.conversationId).toBe("conv-new");
  });

  it("ignores a corrupt or foreign stored value", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    const { calls } = mockExchange(session(), session());
    await make(storage).session();
    expect(calls[0].body).toEqual({});

    storage.setItem(STORAGE_KEY, JSON.stringify("a string"));
    await make(storage).session();
    expect(calls[1].body).toEqual({});

    storage.setItem(STORAGE_KEY, JSON.stringify({ resume: 1, conversationId: 2, userId: 3 }));
    expect(make(storage).conversationId).toBeUndefined();
  });

  it("uses a custom storage key", async () => {
    mockExchange(session());
    const storage = new MemoryStorage();
    await make(storage, { storageKey: "my-key" }).session();
    expect(storage.getItem("my-key")).not.toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("caches the token until shortly before it expires", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { fn } = mockExchange(session({ expires_in: 120 }), session({ token: "tok-2" }));
    const auth = make();
    expect((await auth.authenticate(CTX)).token).toBe("tok-1");
    expect((await auth.authenticate(CTX)).token).toBe("tok-1");
    expect(fn).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 61_000); // inside the 60 s margin
    expect((await auth.authenticate(CTX)).token).toBe("tok-2");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("defaults the lifetime to 30 minutes", async () => {
    mockExchange(session({ expires_in: undefined }));
    const before = Date.now();
    const s = await make().session();
    expect(s.expiresAt).toBeGreaterThanOrEqual(before + 1_800_000);
  });

  it("shares one request between concurrent callers", async () => {
    const { fn } = mockExchange(session());
    const auth = make();
    const [a, b] = await Promise.all([auth.session(), auth.authenticate(CTX)]);
    expect(a.token).toBe("tok-1");
    expect(b.token).toBe("tok-1");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ── Rejection and retry ────────────────────────────────────────────────

describe("PublishableKeyAuth — rejected tokens", () => {
  it("exchanges again with resume after a rejection, up to maxRetries", async () => {
    const { calls } = mockExchange(session(), session({ token: "tok-2", resume: "res-2", resumed: true }));
    const auth = make();
    await auth.authenticate(CTX);
    const rejected = { code: "unauthorized", message: "expired" };
    expect(auth.onReject(rejected, CTX)).toBe("retry");
    const retry = await auth.authenticate({ ...CTX, attempt: 1, previousError: rejected });
    expect(retry.token).toBe("tok-2");
    expect(calls[1].body).toEqual({ resume: "res-1" });
    expect(auth.onReject(rejected, { ...CTX, attempt: 1 })).toBe("fail");
    expect(make(null, { maxRetries: 0 }).onReject(rejected, CTX)).toBe("fail");
  });

  it("never hands a retry the cached token, even without onReject", async () => {
    const { fn } = mockExchange(session(), session({ token: "tok-2" }));
    const auth = make();
    await auth.authenticate(CTX);
    const retry = await auth.authenticate({ ...CTX, previousError: { code: "unauthorized", message: "" } });
    expect(retry.token).toBe("tok-2");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("forget() starts a new conversation on the next exchange", async () => {
    const storage = new MemoryStorage();
    const { calls } = mockExchange(session(), session({ conversationId: "conv-2" }));
    const auth = make(storage);
    await auth.session();
    auth.forget();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(auth.conversationId).toBeUndefined();
    const s = await auth.session();
    expect(calls[1].body).toEqual({});
    expect(s.conversationId).toBe("conv-2");
  });
});

// ── Storage unavailable ────────────────────────────────────────────────

describe("PublishableKeyAuth — without storage", () => {
  it("keeps resume in memory with storage: null", async () => {
    const { calls } = mockExchange(session(), session({ resumed: true }));
    const auth = make(null);
    await auth.session();
    await auth.session({ fresh: true });
    expect(calls[1].body).toEqual({ resume: "res-1" });
    auth.forget();
  });

  it("survives a storage that throws on every access", async () => {
    const { calls } = mockExchange(session(), session({ resumed: true }));
    const auth = make(new BrokenStorage());
    expect(auth.conversationId).toBeUndefined();
    await auth.session();
    await auth.session({ fresh: true });
    expect(calls[1].body).toEqual({ resume: "res-1" });
    expect(() => auth.forget()).not.toThrow();
  });

  describe("default storage", () => {
    const fromDefaults = () => new PublishableKeyAuth({ baseUrl: "http://hub.test", publishableKey: KEY });
    let original: PropertyDescriptor | undefined;

    beforeEach(() => {
      original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    });

    afterEach(() => {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete (globalThis as { localStorage?: Storage }).localStorage;
    });

    it("uses localStorage when no storage is given", async () => {
      const storage = new MemoryStorage();
      Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
      mockExchange(session());
      await fromDefaults().session();
      expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    it("works when localStorage is missing", async () => {
      Object.defineProperty(globalThis, "localStorage", { value: undefined, configurable: true });
      const { calls } = mockExchange(session(), session());
      const auth = fromDefaults();
      await auth.session();
      await auth.session({ fresh: true });
      expect(calls[1].body).toEqual({ resume: "res-1" });
    });

    it("works when the localStorage getter throws", async () => {
      const get = vi.fn(() => {
        throw new Error("SecurityError");
      });
      Object.defineProperty(globalThis, "localStorage", { get, configurable: true });
      mockExchange(session());
      expect((await fromDefaults().session()).token).toBe("tok-1");
      expect(get).toHaveBeenCalled();
    });
  });
});

// ── Errors ─────────────────────────────────────────────────────────────

describe("PublishableKeyAuth — errors", () => {
  async function failure(response: Response): Promise<ConvergerApiError> {
    mockExchange(response);
    const err = await make().session().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConvergerApiError);
    return err as ConvergerApiError;
  }

  it("maps an unknown or disabled key to unauthorized", async () => {
    const err = await failure(json({ error: { code: "unauthorized", message: "unknown key" } }, 401));
    expect(err.status).toBe(401);
    expect(err.code).toBe("unauthorized");
    expect(err.message).toContain("unknown key");
    expect(err.retryAfterMs).toBeUndefined();
  });

  it("maps a page origin outside the allow-list to origin_not_allowed", async () => {
    const err = await failure(json({ code: "origin_not_allowed", message: "nope" }, 403));
    expect([err.status, err.code]).toEqual([403, "origin_not_allowed"]);
  });

  it("maps rate limiting with retry-after seconds", async () => {
    const err = await failure(json({ error: { code: "rate_limited" } }, 429, { "retry-after": "7" }));
    expect([err.status, err.code, err.retryAfterMs]).toEqual([429, "rate_limited", 7000]);
  });

  it("reads a retry-after HTTP date", async () => {
    const at = new Date(Date.now() + 30_000).toUTCString();
    const err = await failure(json({}, 429, { "retry-after": at }));
    expect(err.code).toBe("rate_limited");
    expect(err.retryAfterMs).toBeGreaterThan(20_000);
    expect(err.retryAfterMs).toBeLessThanOrEqual(30_000);
    expect((await failure(json({}, 429, { "retry-after": "soon" }))).retryAfterMs).toBeUndefined();
  });

  it("falls back to the status for a body without a code", async () => {
    expect((await failure(new Response("bad gateway", { status: 401 }))).code).toBe("unauthorized");
    expect((await failure(new Response(null, { status: 403 }))).code).toBe("origin_not_allowed");
    expect((await failure(new Response(null, { status: 502 }))).code).toBe("http_502");
  });

  it("rejects a success without a token or conversation", async () => {
    expect((await failure(json({ token: "t" }))).code).toBe("invalid_response");
    expect((await failure(json({ conversationId: "c" }))).code).toBe("invalid_response");
    expect((await failure(json(null))).code).toBe("invalid_response");
  });

  it("lets the next call try again after a failure", async () => {
    mockExchange(json({}, 429), session());
    const auth = make();
    await expect(auth.session()).rejects.toBeInstanceOf(ConvergerApiError);
    expect((await auth.session()).token).toBe("tok-1");
  });
});
