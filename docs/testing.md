# Testing & coverage

Every `@chativa/*` package is tested with [Vitest](https://vitest.dev/). Coverage is measured with the V8 provider (`@vitest/coverage-v8`) and enforced per package, both locally and in CI.

## Running the tests

From the repository root:

```bash
pnpm test               # run every package's test suite once
pnpm test:watch         # watch mode across the workspace
pnpm test:coverage      # run every package's suite with coverage + thresholds
pnpm coverage:summary   # print the per-package + monorepo-wide coverage table
```

For a single package, filter by name or run Vitest inside the package:

```bash
pnpm --filter @chativa/core test
pnpm --filter @chativa/connector-websocket test:coverage

cd packages/core
npx vitest run src/application/__tests__/ChatEngine.test.ts
```

Tests resolve `@chativa/core` (and other workspace packages) from **source** through an alias in each package's `vitest.config.ts`, so you don't need to build first. The one exception is `pnpm --filter @chativa/rn-webview typecheck`, which reads `@chativa/core`'s built `dist` — run `pnpm --filter @chativa/core build` before it.

## Where tests live

Tests sit next to the code they cover, in a `__tests__` folder that mirrors the source path:

```
packages/core/src/application/ChatEngine.ts
packages/core/src/application/__tests__/ChatEngine.test.ts
```

Connector tests replace the transport with a test double — a stub `WebSocket` / `EventSource` class installed with `vi.stubGlobal`, a stubbed `fetch`, or `vi.mock("@microsoft/signalr")` for the SignalR hub — and use fake timers (`vi.useFakeTimers()`) for polling and reconnect delays. They test what a connector does (connect, disconnect, reconnect, send, how frames map to messages, history, status/typing/progress callbacks and error paths), not how it is built internally.

## Coverage reports

`pnpm test:coverage` runs `pnpm -r --no-bail --filter @chativa/* run --if-present test:coverage`. Every package that defines a `test:coverage` script (`vitest run --coverage`) writes its report to `packages/<name>/coverage/`:

| File | Use |
|---|---|
| `index.html` | Browsable HTML report |
| `lcov.info` | For editors and coverage services |
| `coverage-summary.json` | Totals, used by CI for the job summary and the README badge |

Test files, `__tests__` folders and pure re-export barrels (`src/index.ts`) are excluded from coverage. `coverage/` folders are git-ignored.

## Thresholds

Each package sets `coverage.thresholds` in its `vitest.config.ts`, a few points below its measured coverage. If coverage drops below a threshold, `vitest run --coverage` exits non-zero, so `pnpm test:coverage` fails too.

| Package | Lines | Functions | Branches | Statements |
|---|---:|---:|---:|---:|
| `@chativa/core` | 95 | 95 | 90 | 95 |
| `@chativa/connector-http` | 95 | 95 | 90 | 95 |
| `@chativa/connector-sse` | 95 | 95 | 90 | 95 |
| `@chativa/connector-websocket` | 95 | 95 | 90 | 95 |
| `@chativa/connector-signalr` | 95 | 95 | 90 | 95 |
| `@chativa/connector-mekik` | 95 | 95 | 92 | 95 |
| `@chativa/rn-webview` | 95 | 95 | 90 | 95 |

Other packages set their own thresholds in their `vitest.config.ts`. A package without a `test:coverage` script is skipped by `pnpm test:coverage` (`--if-present`). Its tests still run under `pnpm test`.

When you add a feature, add tests for it in the same PR. If a refactor lowers coverage for a good reason, lower that package's threshold in the same PR and say why in the description. Don't remove a threshold.

## CI

The `CI` workflow (`.github/workflows/ci.yml`) runs on every push to and pull request against `main`:

1. `pnpm build`, `pnpm typecheck`, `pnpm test`.
2. `pnpm test:coverage`. **The job fails if any package is below its thresholds.** `--no-bail` makes every package report before the step fails.
3. `pnpm coverage:summary` adds a table to the job summary: per-package coverage, plus a monorepo-wide total weighted by line counts (covered lines ÷ total lines across all packages, not an average of percentages).
4. Every `packages/*/coverage/` folder is uploaded as the `coverage` artifact (kept 14 days), so you can download the HTML/lcov reports for any run.
5. On pushes to `main` only, `node scripts/coverage-summary.mjs --badge` updates the README coverage badge to the weighted line total, and the bot commits it as `chore: update coverage badge [skip ci]`.
