/**
 * Schema-drift guard for `SignalRConnectorOptions` ↔ `schemas/connectors/signalr.schema.json`.
 *
 * Same two-sided check as core's
 * `domain/value-objects/__tests__/schema-drift.test.ts`:
 *
 * 1. **Compile-time** — `EXPECTED` uses the mapped type
 *    `{ [K in keyof Required<T>]: true }`, so adding or removing an option on
 *    `SignalRConnectorOptions` without updating it fails `pnpm typecheck`.
 * 2. **Runtime** — the JSON Schema's `properties` keys must exactly match
 *    `EXPECTED`, so a schema-only change fails `pnpm test`.
 *
 * See `AGENTS.md → Schema Sync Rule` and `schemas/README.md`.
 */

import { describe, it, expect } from "vitest";
import schema from "../../../../schemas/connectors/signalr.schema.json";
import type { SignalRConnectorOptions } from "../SignalRConnector";

// ── Compile-time contract ──────────────────────────────────────────────

const EXPECTED: { [K in keyof Required<SignalRConnectorOptions>]: true } = {
  url: true,
  hubName: true,
  receiveMethod: true,
  sendMethod: true,
  surveyMethod: true,
  genUIEventMethod: true,
  accessTokenFactory: true,
};

// ── Schema accessor ────────────────────────────────────────────────────

interface JsonSchema {
  properties?: Record<string, JsonSchema>;
}

const optionsSchema = schema as unknown as JsonSchema;

function keys(obj: Record<string, unknown> | undefined): string[] {
  return Object.keys(obj ?? {}).sort();
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("schema drift — schemas/connectors/signalr.schema.json ↔ SignalRConnectorOptions", () => {
  it("SignalRConnectorOptions fields match the schema", () => {
    expect(keys(optionsSchema.properties)).toEqual(keys(EXPECTED));
  });
});
