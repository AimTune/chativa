/**
 * Schema-drift guard for `WebSocketConnectorOptions` ↔ `schemas/connectors/websocket.schema.json`.
 *
 * Same two-sided check as core's
 * `domain/value-objects/__tests__/schema-drift.test.ts`:
 *
 * 1. **Compile-time** — `EXPECTED` uses the mapped type
 *    `{ [K in keyof Required<T>]: true }`, so adding or removing an option on
 *    `WebSocketConnectorOptions` without updating it fails `pnpm typecheck`.
 * 2. **Runtime** — the JSON Schema's `properties` keys must exactly match
 *    `EXPECTED`, so a schema-only change fails `pnpm test`.
 *
 * See `AGENTS.md → Schema Sync Rule` and `schemas/README.md`.
 */

import { describe, it, expect } from "vitest";
import schema from "../../../../schemas/connectors/websocket.schema.json";
import type { WebSocketConnectorOptions } from "../WebSocketConnector";

// ── Compile-time contract ──────────────────────────────────────────────

const EXPECTED: { [K in keyof Required<WebSocketConnectorOptions>]: true } = {
  url: true,
  protocols: true,
  reconnect: true,
  reconnectDelay: true,
  maxReconnectAttempts: true,
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

describe("schema drift — schemas/connectors/websocket.schema.json ↔ WebSocketConnectorOptions", () => {
  it("WebSocketConnectorOptions fields match the schema", () => {
    expect(keys(optionsSchema.properties)).toEqual(keys(EXPECTED));
  });
});
