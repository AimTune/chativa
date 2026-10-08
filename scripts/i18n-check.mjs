#!/usr/bin/env node
/**
 * i18n-check — verifies every bundled locale against English.
 *
 * Sources checked:
 *   - ui:    packages/ui/src/i18n/<code>.json          (nested JSON)
 *   - genui: packages/genui/src/i18n/index.ts          (one flat block per locale,
 *                                                       registered in GENUI_LOCALES)
 *
 * Problems reported (each fails the check):
 *   missingKey         key present in en, absent in the locale
 *   extraKey           key absent in en, present in the locale
 *   missingPlural      plural form the locale's CLDR rules need (Intl.PluralRules)
 *   invalidPlural      suffix that is not a CLDR plural category
 *   placeholder        {{placeholders}} differ from the English string
 *   empty              empty or non-string value
 *   untranslated       value identical to English (outside the allowlist)
 *   missingLocale      locale has a ui bundle but no genui block, or vice versa
 *   unregistered       ui JSON file not imported by packages/ui/src/i18n/i18n.ts
 *
 * Usage:
 *   node scripts/i18n-check.mjs            human-readable report
 *   node scripts/i18n-check.mjs --json     machine-readable report on stdout
 *
 * Exit code: 0 when clean, 1 when any problem is found, 2 on a crash.
 * No dependencies beyond Node >= 18.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REFERENCE_LOCALE = "en";
export const CLDR_CATEGORIES = ["zero", "one", "two", "few", "many", "other"];

/**
 * English values a locale may legitimately keep unchanged.
 * `*` applies to every locale; per-locale entries cover words that are
 * spelled the same in that language.
 */
export const ALLOW_IDENTICAL = {
  "*": ["Chativa Chatbot", "Chat", "Emoji", "Online", "Offline", "OK"],
  es: ["Error"],
  fr: ["Assistant"],
  nl: ["Parameters"],
};

const PLURAL_RE = new RegExp(`^(.+)_(${CLDR_CATEGORIES.join("|")})$`);
const SUFFIX_RE = /^(.+)_([a-z]+)$/;
const PLACEHOLDER_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const UI_DIR = "packages/ui/src/i18n";
export const UI_REGISTRY = "packages/ui/src/i18n/i18n.ts";
export const GENUI_FILE = "packages/genui/src/i18n/index.ts";

/** Read a file by its repo-relative path (lets tests avoid Node typings). */
export function readRepoFile(relPath, root = ROOT) {
  return readFileSync(join(root, relPath), "utf8");
}

// ── Loading ──────────────────────────────────────────────────────────────────

/** Flatten nested JSON into dot-separated keys. */
export function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

/**
 * Parse the GenUI resources file without a TypeScript toolchain. Relies on the
 * documented shape: `const NAME: Record<string, string> = { "k": "v", ... };`
 * blocks plus a `GENUI_LOCALES = { "code": NAME, ... }` map.
 */
export function parseGenuiSource(source) {
  const blocks = {};
  const blockRe = /const\s+([A-Z][A-Z0-9_]*)\s*:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\r?\n\};/g;
  for (const m of source.matchAll(blockRe)) {
    const entries = {};
    const entryRe = /^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/gm;
    for (const e of m[2].matchAll(entryRe)) entries[JSON.parse(e[1])] = JSON.parse(e[2]);
    blocks[m[1]] = entries;
  }
  const mapMatch = source.match(/^export const GENUI_LOCALES[^=]*=\s*\{([\s\S]*?)\};/m);
  if (!mapMatch) throw new Error(`${GENUI_FILE}: GENUI_LOCALES map not found`);
  const locales = {};
  for (const e of mapMatch[1].matchAll(/["']?([A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*)["']?\s*:\s*([A-Z][A-Z0-9_]*)/g)) {
    if (!blocks[e[2]]) throw new Error(`${GENUI_FILE}: GENUI_LOCALES references unknown block ${e[2]}`);
    locales[e[1]] = blocks[e[2]];
  }
  return locales;
}

/** Load every locale from disk. Returns `{ ui, genui, uiRegistry }`. */
export function loadLocales(root = ROOT) {
  const ui = {};
  for (const file of readdirSync(join(root, UI_DIR)).filter((f) => f.endsWith(".json")).sort()) {
    ui[file.slice(0, -5)] = flatten(JSON.parse(readFileSync(join(root, UI_DIR, file), "utf8")));
  }
  const genui = parseGenuiSource(readFileSync(join(root, GENUI_FILE), "utf8"));
  const uiRegistry = readFileSync(join(root, UI_REGISTRY), "utf8");
  return { ui, genui, uiRegistry };
}

// ── Comparison ───────────────────────────────────────────────────────────────

export function pluralCategories(locale) {
  return new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
}

function placeholders(value) {
  return [...new Set([...String(value).matchAll(PLACEHOLDER_RE)].map((m) => m[1].split(",")[0].trim()))].sort();
}

/** Split English keys into plain keys and plural bases (those with an `_other` form). */
function describeReference(ref) {
  const pluralBases = new Set();
  for (const key of Object.keys(ref)) {
    const m = key.match(PLURAL_RE);
    if (m && `${m[1]}_other` in ref) pluralBases.add(m[1]);
  }
  const plain = Object.keys(ref).filter((k) => {
    const m = k.match(PLURAL_RE);
    return !(m && pluralBases.has(m[1]));
  });
  return { plain, pluralBases };
}

function isAllowedIdentical(locale, value) {
  const stripped = String(value).replace(PLACEHOLDER_RE, "");
  if (!/\p{L}/u.test(stripped)) return true; // emoji, numbers, punctuation only
  const allowed = [...(ALLOW_IDENTICAL["*"] ?? []), ...(ALLOW_IDENTICAL[locale] ?? [])];
  return allowed.includes(value);
}

/**
 * Compare one locale's flat key → value map against the reference.
 * Returns a list of `{ type, key, expected?, actual?, detail? }`.
 */
export function compareLocale(ref, loc, locale) {
  const problems = [];
  const { plain, pluralBases } = describeReference(ref);
  const required = pluralCategories(locale);
  const expected = new Map(); // locale key → English source key

  const pluralKeys = new Set();

  for (const key of plain) expected.set(key, key);
  for (const base of pluralBases) {
    for (const cat of required) {
      expected.set(`${base}_${cat}`, `${base}_other`);
      pluralKeys.add(`${base}_${cat}`);
    }
  }

  for (const [key, source] of expected) {
    if (key in loc) continue;
    problems.push(
      pluralKeys.has(key)
        ? { type: "missingPlural", key, english: ref[source], pluralCategories: required }
        : { type: "missingKey", key, english: ref[source] },
    );
  }

  for (const [key, value] of Object.entries(loc)) {
    let source = expected.get(key);
    if (!source) {
      const m = key.match(SUFFIX_RE);
      if (m && pluralBases.has(m[1])) {
        if (!CLDR_CATEGORIES.includes(m[2])) {
          problems.push({ type: "invalidPlural", key, detail: `"${m[2]}" is not a CLDR plural category` });
          continue;
        }
        // A valid category this ICU build does not use for the locale — harmless
        // (and differs between Node/ICU versions), so check it like the others.
        source = `${m[1]}_other`;
      } else {
        problems.push({ type: "extraKey", key });
        continue;
      }
    }
    if (typeof value !== "string" || value.trim() === "") {
      problems.push({ type: "empty", key });
      continue;
    }
    const want = placeholders(ref[source]);
    const got = placeholders(value);
    if (want.join("\u0000") !== got.join("\u0000")) {
      problems.push({ type: "placeholder", key, expected: want, actual: got });
    }
    if (locale !== REFERENCE_LOCALE && value === ref[source] && !isAllowedIdentical(locale, value)) {
      problems.push({ type: "untranslated", key, english: value });
    }
  }
  return problems;
}

/** Run every check. Returns `{ ok, locales, problems: [{ source, locale, file, ...problem }] }`. */
export function checkLocales({ ui, genui, uiRegistry }) {
  const problems = [];
  const sources = [
    { source: "ui", data: ui, file: (l) => `${UI_DIR}/${l}.json` },
    { source: "genui", data: genui, file: () => GENUI_FILE },
  ];
  for (const { source, data, file } of sources) {
    const ref = data[REFERENCE_LOCALE];
    if (!ref) throw new Error(`${source}: reference locale "${REFERENCE_LOCALE}" not found`);
    for (const locale of Object.keys(data).sort()) {
      for (const p of compareLocale(ref, data[locale], locale)) {
        problems.push({ source, locale, file: file(locale), ...p });
      }
    }
  }
  const all = [...new Set([...Object.keys(ui), ...Object.keys(genui)])].sort();
  for (const locale of all) {
    if (!(locale in ui)) problems.push({ source: "ui", locale, file: `${UI_DIR}/${locale}.json`, type: "missingLocale" });
    if (!(locale in genui)) problems.push({ source: "genui", locale, file: GENUI_FILE, type: "missingLocale" });
  }
  if (uiRegistry !== undefined) {
    for (const locale of Object.keys(ui)) {
      if (!uiRegistry.includes(`./${locale}.json`)) {
        problems.push({ source: "ui", locale, file: UI_REGISTRY, type: "unregistered" });
      }
    }
  }
  return { ok: problems.length === 0, locales: all, problems };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function formatProblem(p) {
  const where = p.key ? ` ${p.key}` : "";
  switch (p.type) {
    case "missingKey":    return `missing key${where} (en: ${JSON.stringify(p.english)})`;
    case "missingPlural": return `missing plural form${where} (needs: ${p.pluralCategories.join(", ")}; en _other: ${JSON.stringify(p.english)})`;
    case "placeholder":   return `placeholder mismatch${where}: expected [${p.expected.join(", ")}], got [${p.actual.join(", ")}]`;
    case "untranslated":  return `untranslated${where}: ${JSON.stringify(p.english)}`;
    case "missingLocale": return `locale has no ${p.source} resources`;
    case "unregistered":  return `${p.locale}.json is not imported by ${UI_REGISTRY}`;
    default:              return `${p.type}${where}${p.detail ? `: ${p.detail}` : ""}`;
  }
}

function main(argv) {
  const report = checkLocales(loadLocales());
  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (report.ok) {
    console.log(`i18n-check: ${report.locales.length} locales OK (${report.locales.join(", ")})`);
  } else {
    const groups = new Map();
    for (const p of report.problems) {
      const g = `${p.locale} [${p.source}] ${p.file}`;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(p);
    }
    for (const [g, ps] of groups) {
      console.log(g);
      for (const p of ps) console.log(`  - ${formatProblem(p)}`);
    }
    console.log(`\ni18n-check: ${report.problems.length} problem(s) in ${groups.size} locale bundle(s)`);
  }
  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    console.error(`i18n-check: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
  }
}
