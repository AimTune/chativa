/**
 * Hand-rolled stand-in for `botframework-directlinejs`.
 *
 * The real SDK opens a WebSocket on construction, so it can't run under
 * jsdom. This fake exposes the same surface the connector touches
 * (`connectionStatus$`, `activity$`, `postActivity`, `end`) backed by a
 * minimal RxJS-5-style Subject, and records every instance so tests can
 * drive the most recently created one.
 */
import { vi } from "vitest";
import type { Activity } from "botframework-directlinejs";

type Observer<T> = {
  next?: (value: T) => void;
  error?: (err: unknown) => void;
};

export interface Subscription {
  unsubscribe(): void;
}

/** Minimal multicast Subject supporting both subscribe(fn) and subscribe({ next, error }). */
export class FakeSubject<T> {
  private observers = new Set<Observer<T>>();

  subscribe(arg?: ((value: T) => void) | Observer<T>): Subscription {
    const observer: Observer<T> =
      typeof arg === "function" ? { next: arg } : (arg ?? {});
    this.observers.add(observer);
    return { unsubscribe: () => this.observers.delete(observer) };
  }

  next(value: T): void {
    for (const o of [...this.observers]) o.next?.(value);
  }

  error(err: unknown): void {
    for (const o of [...this.observers]) o.error?.(err);
  }

  get observerCount(): number {
    return this.observers.size;
  }
}

/** Mirrors the real SDK's enum values. */
export const ConnectionStatus = {
  Uninitialized: 0,
  Connecting: 1,
  Online: 2,
  ExpiredToken: 3,
  FailedToConnect: 4,
  Ended: 5,
} as const;

/** An observable that emits a fake activity id synchronously (default postActivity result). */
export function syncOk(id = "posted-id"): FakeSubject<string> {
  return {
    subscribe(arg?: ((v: string) => void) | Observer<string>) {
      const o = typeof arg === "function" ? { next: arg } : (arg ?? {});
      o.next?.(id);
      return { unsubscribe: () => {} };
    },
  } as unknown as FakeSubject<string>;
}

/** An observable that errors synchronously. */
export function syncError(err: unknown): FakeSubject<string> {
  return {
    subscribe(arg?: ((v: string) => void) | Observer<string>) {
      const o = typeof arg === "function" ? { next: arg } : (arg ?? {});
      o.error?.(err);
      return { unsubscribe: () => {} };
    },
  } as unknown as FakeSubject<string>;
}

export class FakeDirectLine {
  static instances: FakeDirectLine[] = [];

  static get last(): FakeDirectLine {
    const inst = FakeDirectLine.instances.at(-1);
    if (!inst) throw new Error("No FakeDirectLine created yet");
    return inst;
  }

  static reset(): void {
    FakeDirectLine.instances = [];
  }

  readonly connectionStatus$ = new FakeSubject<number>();
  readonly activity$ = new FakeSubject<Activity>();
  readonly postActivity = vi.fn((_activity: Record<string, unknown>) => syncOk());
  readonly end = vi.fn();

  readonly options: Record<string, unknown>;

  constructor(options: Record<string, unknown>) {
    this.options = options;
    FakeDirectLine.instances.push(this);
  }

  /** Activities passed to postActivity, in order. */
  get posted(): Array<Record<string, unknown>> {
    return this.postActivity.mock.calls.map((c) => c[0]);
  }
}
