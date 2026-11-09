import type {
  MekikAuthContext,
  MekikAuthDecision,
  MekikAuthError,
  MekikAuthProvider,
  MekikCredential,
} from "@chativa/connector-mekik";
import { ConvergerApiError } from "./errors";

/**
 * A credential that also names the conversation (and user) its token is bound
 * to. `ConvergerConnector` adopts `conversationId` before it opens the socket,
 * so a reload resumes the same conversation and its history.
 */
export interface ConvergerCredential extends MekikCredential {
  conversationId?: string;
  userId?: string;
}

export interface PublishableKeyAuthOptions {
  /**
   * Converger's base URL, e.g. "https://chat.example.com". The client API base
   * ("https://chat.example.com/api/v1/converger") is accepted too.
   */
  baseUrl: string;
  /** The channel's publishable key, `cvg_pk_...`. Safe to ship in page code. */
  publishableKey: string;
  /**
   * Where the `resume` credential and conversation id are kept across reloads.
   * Default `localStorage`; `null` keeps them in memory only (a reload starts a
   * new conversation).
   */
  storage?: Storage | null;
  /** Storage key. Default `chativa:converger:pk:<publishableKey>`. */
  storageKey?: string;
  /** How many times a rejected token is replaced before the connection gives up. Default 1. */
  maxRetries?: number;
}

/** One answer of `POST /tokens/publishable`. */
export interface PublishableKeySession {
  /** The conversation the token is bound to. */
  conversationId: string;
  /** Conversation-bound token for the socket and the REST API. */
  token: string;
  /** Epoch ms after which the token is no longer accepted. */
  expiresAt: number;
  /** The anonymous user Converger minted for this visitor (`anon_...`). */
  userId: string;
  /** False when Converger started a new conversation (no or an unusable `resume`). */
  resumed: boolean;
}

interface Stored {
  resume?: string;
  conversationId?: string;
  userId?: string;
}

const API_PATH = "/api/v1/converger";
/** A cached token is replaced when it has less than this left. */
const TOKEN_MARGIN_MS = 60_000;
/** Fallback error codes for an error answer without a JSON body. */
const STATUS_CODES: Record<number, string> = {
  401: "unauthorized",
  403: "origin_not_allowed",
  429: "rate_limited",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // a sandboxed iframe throws on the getter
  }
}

/** `retry-after` as ms: delta-seconds or an HTTP date. */
function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/**
 * Auth for a site without a backend: a Converger **publishable key**
 * (`cvg_pk_...`) is exchanged in the browser for a conversation-bound token
 * (`POST /api/v1/converger/tokens/publishable`). Converger checks the page's
 * `Origin` against the channel's allowed origins.
 *
 * The answer's `resume` credential is kept in `localStorage` per key and sent
 * with the next exchange, so a reload — or a token Converger rejected — gets a
 * fresh token for the same conversation. When `resume` is no longer usable
 * Converger silently starts a new conversation, and the stored one is replaced.
 *
 * The token is cached until shortly before it expires; a rejection
 * (`onReject`) drops it, so the retry exchanges again.
 */
export class PublishableKeyAuth implements MekikAuthProvider {
  readonly name = "publishable-key";
  /**
   * Tells `ConvergerConnector` that the credential names its conversation: the
   * connector asks for it before connecting and adopts `conversationId`.
   */
  readonly conversationBound = true;

  readonly #endpoint: string;
  readonly #publishableKey: string;
  readonly #storage: Storage | null;
  readonly #storageKey: string;
  readonly #maxRetries: number;

  /** Mirrors the stored state, so everything works without storage. */
  #state: Stored;
  #session: PublishableKeySession | null = null;
  #inflight: Promise<PublishableKeySession> | null = null;

  constructor(options: PublishableKeyAuthOptions) {
    const base = options.baseUrl.trim().replace(/\/+$/, "");
    const api = base.endsWith(API_PATH) ? base : `${base}${API_PATH}`;
    this.#endpoint = `${api}/tokens/publishable`;
    this.#publishableKey = options.publishableKey.trim();
    this.#storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.#storageKey = options.storageKey ?? `chativa:converger:pk:${this.#publishableKey}`;
    this.#maxRetries = options.maxRetries ?? 1;
    this.#state = this.#load() ?? {};
  }

  /** The conversation of the current (or stored) session; undefined before the first exchange. */
  get conversationId(): string | undefined {
    return this.#session?.conversationId ?? this.#state.conversationId;
  }

  /**
   * The current session, exchanging the key when there is none or its token is
   * about to expire. `fresh: true` always exchanges (with `resume`).
   * Concurrent calls share one request.
   */
  async session(options: { fresh?: boolean } = {}): Promise<PublishableKeySession> {
    const current = this.#session;
    if (!options.fresh && current && current.expiresAt - TOKEN_MARGIN_MS > Date.now()) return current;
    if (!this.#inflight) {
      this.#inflight = this.#exchange().finally(() => {
        this.#inflight = null;
      });
    }
    return this.#inflight;
  }

  async authenticate(ctx: MekikAuthContext): Promise<ConvergerCredential> {
    // A retry after a rejection must not hand back the token that was just refused.
    const fresh = ctx.attempt > 0 || ctx.previousError !== null;
    const { token, conversationId, userId } = await this.session({ fresh });
    return { token, conversationId, ...(userId ? { userId } : {}) };
  }

  onReject(_error: MekikAuthError, ctx: MekikAuthContext): MekikAuthDecision {
    this.#session = null;
    return ctx.attempt < this.#maxRetries ? "retry" : "fail";
  }

  /** Drop the session and the stored `resume`: the next exchange starts a new conversation. */
  forget(): void {
    this.#session = null;
    this.#state = {};
    try {
      this.#storage?.removeItem(this.#storageKey);
    } catch {
      /* storage unavailable — the in-memory state is gone either way */
    }
  }

  async #exchange(): Promise<PublishableKeySession> {
    // Another tab may have moved the conversation on; storage wins over memory.
    const resume = this.#load()?.resume ?? this.#state.resume;
    const res = await fetch(this.#endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.#publishableKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(resume ? { resume } : {}),
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const error = isRecord(body) && isRecord(body.error) ? body.error : isRecord(body) ? body : {};
      const code =
        typeof error.code === "string" ? error.code : (STATUS_CODES[res.status] ?? `http_${res.status}`);
      const message = typeof error.message === "string" ? error.message : res.statusText;
      throw new ConvergerApiError(
        res.status,
        code,
        `Converger publishable key ${res.status} ${code}: ${message}`,
        retryAfterMs(res.headers.get("retry-after")),
      );
    }
    const record = isRecord(body) ? body : {};
    if (typeof record.token !== "string" || !record.token || typeof record.conversationId !== "string" || !record.conversationId) {
      throw new ConvergerApiError(res.status, "invalid_response", "Converger publishable key: no token or conversationId in the response.");
    }
    const ttl = typeof record.expires_in === "number" ? record.expires_in : 1800;
    const session: PublishableKeySession = {
      conversationId: record.conversationId,
      token: record.token,
      expiresAt: Date.now() + ttl * 1000,
      userId: typeof record.userId === "string" ? record.userId : "",
      resumed: record.resumed === true,
    };
    // A new conversation (resumed: false) replaces the stored one, resume and all.
    this.#state = {
      ...(typeof record.resume === "string" && record.resume
        ? { resume: record.resume }
        : session.resumed && resume
          ? { resume }
          : {}),
      conversationId: session.conversationId,
      ...(session.userId ? { userId: session.userId } : {}),
    };
    this.#save();
    this.#session = session;
    return session;
  }

  #load(): Stored | null {
    try {
      const raw = this.#storage?.getItem(this.#storageKey);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return null;
      const stored: Stored = {};
      if (typeof parsed.resume === "string") stored.resume = parsed.resume;
      if (typeof parsed.conversationId === "string") stored.conversationId = parsed.conversationId;
      if (typeof parsed.userId === "string") stored.userId = parsed.userId;
      return stored;
    } catch {
      return null; // unavailable or corrupt — behaves like a first visit
    }
  }

  #save(): void {
    try {
      this.#storage?.setItem(this.#storageKey, JSON.stringify(this.#state));
    } catch {
      /* storage unavailable or full — the session lasts as long as the page */
    }
  }
}
