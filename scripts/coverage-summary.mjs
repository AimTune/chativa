#!/usr/bin/env node
/**
 * Aggregate the v8 `coverage-summary.json` files produced by
 * `pnpm test:coverage` (one per package under `packages/<name>/coverage/`).
 *
 * - Prints a per-package table plus a monorepo-wide total. Totals are
 *   weighted by the number of lines/statements/… in each package (covered /
 *   total summed across packages), not a plain average of percentages, so a
 *   tiny package can't skew the result.
 * - When `GITHUB_STEP_SUMMARY` is set (GitHub Actions), appends the same
 *   table as Markdown to the job summary.
 * - With `--badge`, rewrites the `[![Coverage](…)](…)` badge in README.md
 *   with the aggregate line coverage.
 *
 * Usage: node scripts/coverage-summary.mjs [--badge]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(root, "packages");
const METRICS = ["lines", "statements", "functions", "branches"];

const rows = [];
for (const name of readdirSync(packagesDir).sort()) {
  const file = join(packagesDir, name, "coverage", "coverage-summary.json");
  if (!existsSync(file)) continue;
  const { total } = JSON.parse(readFileSync(file, "utf8"));
  rows.push({ name: `@chativa/${name}`, total });
}

if (rows.length === 0) {
  console.error("No packages/*/coverage/coverage-summary.json found — run `pnpm test:coverage` first.");
  process.exit(1);
}

const aggregate = {};
for (const m of METRICS) {
  const total = rows.reduce((n, r) => n + r.total[m].total, 0);
  const covered = rows.reduce((n, r) => n + r.total[m].covered, 0);
  aggregate[m] = { total, covered, pct: total > 0 ? (covered / total) * 100 : 100 };
}

const fmt = (pct) => `${pct.toFixed(2)}%`;
const header = ["Package", "Lines", "Statements", "Functions", "Branches"];
const body = rows.map((r) => [r.name, ...METRICS.map((m) => fmt(r.total[m].pct))]);
const totalRow = ["**All packages (weighted)**", ...METRICS.map((m) => `**${fmt(aggregate[m].pct)}**`)];

console.table(
  Object.fromEntries([
    ...rows.map((r) => [r.name, Object.fromEntries(METRICS.map((m) => [m, fmt(r.total[m].pct)]))]),
    ["TOTAL (weighted)", Object.fromEntries(METRICS.map((m) => [m, fmt(aggregate[m].pct)]))],
  ]),
);

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    "## Test coverage",
    "",
    `| ${header.join(" | ")} |`,
    `| ${header.map((_, i) => (i === 0 ? "---" : "---:")).join(" | ")} |`,
    ...[...body, totalRow].map((cells) => `| ${cells.join(" | ")} |`),
    "",
  ].join("\n");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
}

if (process.argv.includes("--badge")) {
  const pct = Math.round(aggregate.lines.pct);
  const color = pct >= 80 ? "brightgreen" : pct >= 70 ? "yellow" : pct >= 50 ? "orange" : "red";
  const badge = `[![Coverage](https://img.shields.io/badge/coverage-${pct}%25-${color})](https://github.com/AimTune/chativa/actions)`;
  const readmePath = join(root, "README.md");
  const readme = readFileSync(readmePath, "utf8");
  const pattern = /\[!\[Coverage\]\(.*?\)\]\(.*?\)/;
  if (!pattern.test(readme)) {
    console.error("README.md has no [![Coverage](…)](…) badge to update.");
    process.exit(1);
  }
  writeFileSync(readmePath, readme.replace(pattern, badge));
  console.log(`Coverage badge: ${pct}% (${color}) across ${rows.length} package(s)`);
}
