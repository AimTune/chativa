/**
 * Schema-drift guard for ThemeConfig.
 *
 * Two complementary checks:
 *
 * 1. **Compile-time contract** — `EXPECTED_*` constants below use a mapped
 *    type `{ [K in keyof Required<T>]: true }`. If a developer adds or
 *    removes a field on `ThemeConfig` (or one of its sub-objects) without
 *    updating these constants, `pnpm typecheck` fails.
 *
 * 2. **Runtime check** — at test time we read `schemas/theme.schema.json`
 *    and assert that the JSON Schema `properties` keys exactly match
 *    these constants. Diverging set => failed test => the JSON schema
 *    must be updated in the same commit as the type.
 *
 * Both checks are necessary: (1) catches the TS-only side, (2) catches the
 * JSON-only side. Together they enforce the rule documented in
 * `AGENTS.md → Schema sync` and `schemas/README.md`.
 */

import { describe, it, expect } from "vitest";
import schema from "../../../../../../schemas/theme.schema.json";
import type {
  ThemeConfig,
  ThemeColors,
  LayoutConfig,
  AvatarConfig,
  EndOfConversationSurveyConfig,
} from "../Theme";

// ── Compile-time contracts ─────────────────────────────────────────────
// Adding/removing a key here must match the TypeScript type — TS will
// complain if they drift.

const EXPECTED_THEME: { [K in keyof Required<ThemeConfig>]: true } = {
  colors: true,
  position: true,
  positionMargin: true,
  size: true,
  layout: true,
  avatar: true,
  allowFullscreen: true,
  showMessageStatus: true,
  enableSearch: true,
  enableMultiConversation: true,
  enableFileUpload: true,
  hideButtonOnOpen: true,
  windowMode: true,
  endOfConversationSurvey: true,
};

const EXPECTED_COLORS: { [K in keyof Required<ThemeColors>]: true } = {
  primary: true,
  secondary: true,
  background: true,
  text: true,
  border: true,
};

const EXPECTED_LAYOUT: { [K in keyof Required<LayoutConfig>]: true } = {
  width: true,
  height: true,
  maxWidth: true,
  maxHeight: true,
  horizontalSpace: true,
  verticalSpace: true,
};

const EXPECTED_AVATAR: { [K in keyof Required<AvatarConfig>]: true } = {
  bot: true,
  user: true,
  header: true,
  showBot: true,
  showUser: true,
};

const EXPECTED_SURVEY: {
  [K in keyof Required<EndOfConversationSurveyConfig>]: true;
} = {
  enabled: true,
  mode: true,
  trigger: true,
  maxRating: true,
  requireCommentBelow: true,
  kind: true,
  resetOnSubmit: true,
};

// ── Schema accessor ────────────────────────────────────────────────────
// `schema` is imported as a typed JSON module (above). Cast through unknown
// to a structural type so we can read nested `.properties` without
// relying on Node fs APIs.

interface JsonSchema {
  properties?: Record<string, JsonSchema>;
}

const themeSchema = schema as unknown as JsonSchema;

function keys(obj: Record<string, unknown> | undefined): string[] {
  return Object.keys(obj ?? {}).sort();
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("schema drift — schemas/theme.schema.json ↔ ThemeConfig", () => {
  it("ThemeConfig top-level fields match the schema", () => {
    expect(keys(themeSchema.properties)).toEqual(keys(EXPECTED_THEME));
  });

  it("ThemeColors fields match schema.properties.colors.properties", () => {
    expect(keys(themeSchema.properties?.colors?.properties)).toEqual(
      keys(EXPECTED_COLORS),
    );
  });

  it("LayoutConfig fields match schema.properties.layout.properties", () => {
    expect(keys(themeSchema.properties?.layout?.properties)).toEqual(
      keys(EXPECTED_LAYOUT),
    );
  });

  it("AvatarConfig fields match schema.properties.avatar.properties", () => {
    expect(keys(themeSchema.properties?.avatar?.properties)).toEqual(
      keys(EXPECTED_AVATAR),
    );
  });

  it("EndOfConversationSurveyConfig fields match schema.properties.endOfConversationSurvey.properties", () => {
    expect(
      keys(themeSchema.properties?.endOfConversationSurvey?.properties),
    ).toEqual(keys(EXPECTED_SURVEY));
  });
});
