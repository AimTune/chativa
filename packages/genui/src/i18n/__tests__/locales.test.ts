import { describe, it, expect } from "vitest";
import {
  GENUI_FILE,
  compareLocale,
  parseGenuiSource,
  readRepoFile,
} from "../../../../../scripts/i18n-check.mjs";
import { GENUI_LOCALES } from "../index";

/**
 * GenUI translation blocks must mirror EN (with each language's own CLDR
 * plural forms). `scripts/i18n-check.mjs` reads this package's i18n/index.ts
 * with a regex instead of a TypeScript toolchain, so the first test also pins
 * that the parser sees exactly what the module registers.
 */
describe("GenUI locales", () => {
  it("scripts/i18n-check.mjs parses exactly the blocks the module registers", () => {
    expect(parseGenuiSource(readRepoFile(GENUI_FILE))).toEqual(GENUI_LOCALES);
  });

  it.each(Object.keys(GENUI_LOCALES).filter((l) => l !== "en"))(
    "%s: keys, CLDR plural forms and placeholders match en",
    (lng) => {
      expect(compareLocale(GENUI_LOCALES.en, GENUI_LOCALES[lng], lng)).toEqual([]);
    },
  );
});
