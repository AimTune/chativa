/**
 * Drift guard: `MekikConnectorSpecOptions` / `MekikAuthSpec` are defined
 * locally (so the published .d.ts gains no dependency) as JSON-safe mirrors of
 * `@chativa/connector-mekik`'s real option types. These assignability checks
 * fail `tsc --noEmit` if the connector's options ever change shape underneath
 * the mirror — e.g. a renamed field or a narrowed union.
 */
import { describe, it, expect } from "vitest";
import type { MekikConnectorOptions, TokenAuthOptions } from "@chativa/connector-mekik";
import type { MekikAuthSpec, MekikConnectorSpecOptions } from "../types";

// Everything except `auth` must be directly assignable to the real options —
// the bootstrap spreads it into the constructor argument untouched.
type SpecRest = Omit<MekikConnectorSpecOptions, "auth">;
const _restAssignable = (o: SpecRest): MekikConnectorOptions => o;

// The token spec (minus the `kind` discriminant) must be a valid TokenAuth
// constructor argument — the bootstrap does `new g.TokenAuth({...rest})`.
type TokenSpec = Extract<MekikAuthSpec, { kind: "token" }>;
const _tokenAssignable = (o: Omit<TokenSpec, "kind">): TokenAuthOptions => o;

describe("mekik spec type compatibility", () => {
  it("compiles — assignability is enforced by tsc, not at runtime", () => {
    expect(typeof _restAssignable).toBe("function");
    expect(typeof _tokenAssignable).toBe("function");
  });
});
