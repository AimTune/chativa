import { TokenAuth } from "@chativa/connector-mekik";

/**
 * Sandbox helpers for a Converger hub (https://github.com/AimTune/converger).
 *
 * Tokens come from the dev server's `/api/converger-token` endpoint
 * (`convergerTokenPlugin` in vite.config.ts), which holds the channel secret
 * and calls `POST /api/v1/converger/tokens/generate` — the browser never sees
 * the secret. A function token means every (re)connect, and every retry after
 * an expired or revoked token, fetches a fresh one.
 */
export function convergerTokenAuth(request: { userId?: string; scope?: "channel" } = {}): TokenAuth {
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

/** Converger's native WebSocket endpoint for a base URL like "http://localhost:4000". */
export function convergerSocketUrl(base: string): string {
  return `${base.trim().replace(/\/+$/, "").replace(/^http/, "ws")}/socket/converger/v1`;
}
