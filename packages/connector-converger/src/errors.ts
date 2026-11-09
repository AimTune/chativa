/** A non-2xx answer from the Converger client API. */
export class ConvergerApiError extends Error {
  /** HTTP status (0 for an `error` frame on the socket). */
  readonly status: number;
  /** Converger's stable error code, e.g. `conversation_closed`. */
  readonly code: string;
  /** From a `retry-after` header (429 `rate_limited`), in ms; undefined without one. */
  readonly retryAfterMs: number | undefined;

  constructor(status: number, code: string, message: string, retryAfterMs?: number) {
    super(message);
    this.name = "ConvergerApiError";
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}
