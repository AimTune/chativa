/**
 * Schema-drift guard for `ConvergerConnectorOptions` ↔ `schemas/connectors/converger.schema.json`.
 *
 * Same two-sided check as connector-mekik's:
 *
 * 1. **Compile-time** — `EXPECTED` uses the mapped type
 *    `{ [K in keyof Required<T>]: true }`, so adding or removing an option on
 *    `ConvergerConnectorOptions` (or on the `MekikConnectorOptions` it extends)
 *    without updating it fails `pnpm typecheck`.
 * 2. **Runtime** — the JSON Schema's `properties` keys must exactly match
 *    `EXPECTED`, so a schema-only change fails `pnpm test`.
 *
 * See `AGENTS.md → Schema Sync Rule` and `schemas/README.md`.
 */

import { describe, it, expect } from "vitest";
import schema from "../../../../schemas/connectors/converger.schema.json";
import mekikSchema from "../../../../schemas/connectors/mekik.schema.json";
import type { ConvergerConnectorOptions } from "../index";

// ── Compile-time contract ──────────────────────────────────────────────

const EXPECTED: { [K in keyof Required<ConvergerConnectorOptions>]: true } = {
  // MekikConnectorOptions
  url: true,
  protocols: true,
  reconnect: true,
  reconnectDelay: true,
  maxReconnectAttempts: true,
  reconnectBackoff: true,
  reconnectMaxDelay: true,
  routeInUrl: true,
  queueOfflineMessages: true,
  userId: true,
  conversationId: true,
  resumeConversation: true,
  auth: true,
  token: true,
  onAuthError: true,
  tools: true,
  allowDynamicTools: true,
  skills: true,
  allowDynamicSkills: true,
  // Converger-only
  apiUrl: true,
  channelScoped: true,
  historyPageSize: true,
  ackTimeout: true,
  maxSendRetries: true,
  readReceipts: true,
  feedbackReactions: true,
};

// ── Schema accessor ────────────────────────────────────────────────────

interface JsonSchema {
  properties?: Record<string, JsonSchema>;
}

function keys(obj: Record<string, unknown> | undefined): string[] {
  return Object.keys(obj ?? {}).sort();
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("schema drift — schemas/connectors/converger.schema.json ↔ ConvergerConnectorOptions", () => {
  it("ConvergerConnectorOptions fields match the schema", () => {
    expect(keys((schema as unknown as JsonSchema).properties)).toEqual(keys(EXPECTED));
  });

  it("covers every mekik option, so the two schemas cannot drift apart", () => {
    const converger = keys((schema as unknown as JsonSchema).properties);
    for (const key of keys((mekikSchema as unknown as JsonSchema).properties)) {
      expect(converger).toContain(key);
    }
  });
});
