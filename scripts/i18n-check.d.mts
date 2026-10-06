// Type declarations for i18n-check.mjs so TypeScript tests can import it.

export type FlatLocale = Record<string, unknown>;

export interface LoadedLocales {
  ui: Record<string, FlatLocale>;
  genui: Record<string, FlatLocale>;
  /** Source of packages/ui/src/i18n/i18n.ts; omit to skip the registration check. */
  uiRegistry?: string;
}

export type ProblemType =
  | "missingKey"
  | "extraKey"
  | "missingPlural"
  | "invalidPlural"
  | "placeholder"
  | "empty"
  | "untranslated"
  | "missingLocale"
  | "unregistered";

export interface LocaleProblem {
  type: ProblemType;
  key?: string;
  english?: string;
  expected?: string[];
  actual?: string[];
  pluralCategories?: string[];
  detail?: string;
}

export interface Problem extends LocaleProblem {
  source: "ui" | "genui";
  locale: string;
  file: string;
}

export interface Report {
  ok: boolean;
  locales: string[];
  problems: Problem[];
}

export const UI_DIR: string;
export const UI_REGISTRY: string;
export const GENUI_FILE: string;
export function readRepoFile(relPath: string, root?: string): string;
export const REFERENCE_LOCALE: string;
export const CLDR_CATEGORIES: string[];
export const ALLOW_IDENTICAL: Record<string, string[]>;
export function flatten(obj: object, prefix?: string): FlatLocale;
export function parseGenuiSource(source: string): Record<string, Record<string, string>>;
export function loadLocales(root?: string): Required<LoadedLocales>;
export function pluralCategories(locale: string): string[];
export function compareLocale(ref: FlatLocale, loc: FlatLocale, locale: string): LocaleProblem[];
export function checkLocales(locales: LoadedLocales): Report;
