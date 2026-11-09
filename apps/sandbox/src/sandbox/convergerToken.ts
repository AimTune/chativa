import { TokenAuth } from "@chativa/connector-mekik";
import { PublishableKeyAuth } from "@chativa/connector-converger";

/**
 * Sandbox helpers for a Converger hub (https://github.com/AimTune/converger).
 *
 * Three ways to get a token, picked per preset in the Connector tab:
 *
 * - **Dev server** (`convergerTokenAuth`): this dev server's
 *   `/api/converger-token` endpoint (`convergerTokenPlugin` in vite.config.ts)
 *   holds the channel secret and calls `POST /api/v1/converger/tokens/generate`
 *   — the browser never sees the secret.
 * - **Token** (`convergerStaticAuth`): a token pasted by hand, e.g. from the
 *   channel page's Test token action. It cannot be renewed.
 * - **Publishable key** (`convergerPublishableAuth`): a `cvg_pk_...` key
 *   exchanged in the browser (`POST /api/v1/converger/tokens/publishable`).
 */
export type ConvergerCredentialMode = "dev-server" | "token" | "publishable-key";

export function convergerTokenAuth(request: { userId?: string; scope?: "channel" } = {}): TokenAuth {
  // A function token: every (re)connect, and every retry after an expired or
  // revoked token, fetches a fresh one.
  return new TokenAuth({
    token: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/converger-token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const body = (await res.json().catch(() => ({}))) as { token?: string; error?: unknown };
      if (!res.ok || !body.token) {
        throw new Error(`Converger token endpoint: ${res.status} ${JSON.stringify(body.error ?? body)}`);
      }
      return body.token;
    },
  });
}

/** A pasted token, used as is: once it expires, paste a new one and connect again. */
export function convergerStaticAuth(token: string): TokenAuth {
  return new TokenAuth({ token: token.trim() });
}

/**
 * A publishable key. The conversation (and its `resume` credential) is kept in
 * localStorage per key, so reconnecting or reloading continues it.
 */
export function convergerPublishableAuth(base: string, publishableKey: string): PublishableKeyAuth {
  return new PublishableKeyAuth({ baseUrl: base, publishableKey });
}

/** Converger's native WebSocket endpoint for a base URL like "http://localhost:4000". */
export function convergerSocketUrl(base: string): string {
  return `${base.trim().replace(/\/+$/, "").replace(/^http/, "ws")}/socket/converger/v1`;
}
