/**
 * Schema-drift guard for DummyConnectorOptions / DummyRule.
 *
 * Same two-sided check as `packages/core/src/domain/value-objects/__tests__/schema-drift.test.ts`:
 *
 * 1. **Compile-time contract** — the `EXPECTED_*` constants use a mapped type
 *    `{ [K in keyof Required<T>]: true }`, so adding or removing a field on the
 *    TypeScript type without updating them fails `tsc`.
 * 2. **Runtime check** — the constants must exactly match the `properties`
 *    keys of `schemas/connectors/dummy.schema.json`.
 */

import { describe, it, expect } from "vitest";
import schema from "../../../../schemas/connectors/dummy.schema.json";
import type {
  DummyConnectorOptions,
  DummyRule,
  DummyGenUIResponse,
} from "../DummyConnector";

// ── Compile-time contracts ─────────────────────────────────────────────

const EXPECTED_OPTIONS: { [K in keyof Required<DummyConnectorOptions>]: true } = {
  name: true,
  replyDelay: true,
  connectDelay: true,
  rules: true,
  capabilities: true,
};

const EXPECTED_RULE: { [K in keyof Required<DummyRule>]: true } = {
  when: true,
  then: true,
  delay: true,
};

const EXPECTED_WHEN: { [K in keyof Required<DummyRule["when"]>]: true } = {
  type: true,
  textMatches: true,
};

const EXPECTED_GENUI_RESPONSE: { [K in keyof Required<DummyGenUIResponse>]: true } = {
  kind: true,
  chunks: true,
};

// ── Schema accessor ────────────────────────────────────────────────────

interface JsonSchema {
  properties?: Record<string, JsonSchema>;
  definitions?: Record<string, JsonSchema>;
  anyOf?: JsonSchema[];
  $ref?: string;
}

const dummySchema = schema as unknown as JsonSchema;
const ruleSchema = dummySchema.definitions?.DummyRule;

function keys(obj: Record<string, unknown> | undefined): string[] {
  return Object.keys(obj ?? {}).sort();
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("schema drift — schemas/connectors/dummy.schema.json ↔ DummyConnectorOptions", () => {
  it("DummyConnectorOptions fields match the schema", () => {
    expect(keys(dummySchema.properties)).toEqual(keys(EXPECTED_OPTIONS));
  });

  it("rules items reference the DummyRule definition", () => {
    const items = (dummySchema.properties?.rules as { items?: JsonSchema } | undefined)?.items;
    expect(items?.$ref).toBe("#/definitions/DummyRule");
  });

  it("DummyRule fields match definitions.DummyRule.properties", () => {
    expect(keys(ruleSchema?.properties)).toEqual(keys(EXPECTED_RULE));
  });

  it("DummyRule.when fields match definitions.DummyRule.properties.when.properties", () => {
    expect(keys(ruleSchema?.properties?.when?.properties)).toEqual(keys(EXPECTED_WHEN));
  });

  it("DummyRule.then covers IncomingMessage and DummyGenUIResponse", () => {
    const variants = ruleSchema?.properties?.then?.anyOf ?? [];
    expect(variants.map((v) => v.$ref).filter(Boolean)).toEqual([
      "../messages/incoming-message.schema.json",
    ]);
    const genui = variants.find((v) => !v.$ref);
    expect(keys(genui?.properties)).toEqual(keys(EXPECTED_GENUI_RESPONSE));
  });
});
