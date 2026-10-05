import { describe, it, expect, afterAll } from "vitest";
import {
  checkLocales,
  compareLocale,
  flatten,
  loadLocales,
  pluralCategories,
  readRepoFile,
} from "../../../../../scripts/i18n-check.mjs";
import i18next, { BUNDLED_LOCALES, SUPPORTED_LOCALES } from "../i18n";
import "@chativa/genui";

/**
 * Key parity for every bundled language. The rules live in
 * `scripts/i18n-check.mjs` (also run in CI) so the test and the pipeline can
 * never disagree; this file asserts the repo passes them and that the bundles
 * actually resolve at runtime.
 */
describe("bundled locales — parity with en", () => {
  const locales = loadLocales();

  it("every ui JSON file on disk is registered in i18n.ts", () => {
    expect(Object.keys(locales.ui).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it("ui and genui ship the same set of languages", () => {
    expect(Object.keys(locales.genui).sort()).toEqual(Object.keys(locales.ui).sort());
  });

  it("passes scripts/i18n-check.mjs with no problems", () => {
    const report = checkLocales(locales);
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it.each(SUPPORTED_LOCALES.filter((l) => l !== "en"))(
    "%s: keys, CLDR plural forms and placeholders match en",
    (lng) => {
      const en = flatten(BUNDLED_LOCALES.en);
      expect(compareLocale(en, flatten(BUNDLED_LOCALES[lng]), lng)).toEqual([]);
    },
  );
});

describe("i18n-check — detects drift", () => {
  const en = flatten(BUNDLED_LOCALES.en);

  it("reports a missing key", () => {
    const de = flatten(BUNDLED_LOCALES.de);
    delete de["header.close"];
    expect(compareLocale(en, de, "de")).toEqual([
      expect.objectContaining({ type: "missingKey", key: "header.close" }),
    ]);
  });

  it("reports a missing CLDR plural form the language needs", () => {
    const ru = flatten(BUNDLED_LOCALES.ru);
    delete ru["survey.starLabel_few"];
    expect(compareLocale(en, ru, "ru")).toEqual([
      expect.objectContaining({ type: "missingPlural", key: "survey.starLabel_few" }),
    ]);
  });

  it("reports a dropped placeholder, an extra key and an untranslated value", () => {
    const fr = flatten(BUNDLED_LOCALES.fr);
    fr["input.removeFile"] = "Retirer";
    fr["greeting"] = "Hello";
    fr["header.nope"] = "x";
    const types = compareLocale(en, fr, "fr").map((p) => p.type).sort();
    expect(types).toEqual(["extraKey", "placeholder", "untranslated"]);
  });
});

describe("bundled locales — runtime resolution", () => {
  afterAll(async () => {
    await i18next.changeLanguage("en");
  });

  it.each(SUPPORTED_LOCALES)("%s: plural keys resolve for every count", async (lng) => {
    await i18next.changeLanguage(lng);
    for (const count of [0, 1, 2, 3, 5, 11, 21, 22, 100, 101, 1.5, 1_000_000]) {
      for (const key of ["survey.starLabel", "toolCalls.summary", "genui.rating.starLabel"]) {
        const value = i18next.t(key, { count });
        expect(value, `${lng} ${key} count=${count}`).not.toContain(key);
        expect(value, `${lng} ${key} count=${count}`).toContain(String(count));
      }
    }
    // Plural categories the runtime asks for all exist in the bundle.
    for (const cat of pluralCategories(lng)) {
      expect(i18next.exists(`survey.starLabel_${cat}`, { lng, fallbackLng: false })).toBe(true);
    }
  });

  it.each([
    ["pt", "pt-BR"],
    ["pt-PT", "pt-BR"],
    ["zh", "zh-CN"],
    ["zh-SG", "zh-CN"],
    ["zh-Hans-CN", "zh-CN"],
    ["zh-Hant", "zh-TW"],
    ["zh-Hant-TW", "zh-TW"],
    ["zh-HK", "zh-TW"],
    ["iw", "he"],
    ["de-AT", "de"],
    ["es-MX", "es"],
    ["xx", "en"],
  ])("detected %s resolves to the %s bundle", async (detected, bundle) => {
    await i18next.changeLanguage(detected);
    const expected = (BUNDLED_LOCALES as Record<string, { greeting: string }>)[bundle].greeting;
    expect(i18next.t("greeting")).toBe(expected);
  });
});

describe("bundled locales — documentation", () => {
  it("lists every bundled language in both docs trees", () => {
    for (const doc of ["website/docs/i18n.md", "docs/i18n.md"]) {
      const text = readRepoFile(doc);
      for (const lng of SUPPORTED_LOCALES) expect(text, `${doc} lists ${lng}`).toContain(`\`${lng}\``);
    }
  });
});
