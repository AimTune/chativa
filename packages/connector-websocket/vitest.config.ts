import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    // Resolve @chativa/core from source so tests don't need a pre-built dist.
    // Array form (not the object shorthand) so the `/frames` subpath is matched
    // before the bare package name — otherwise it would resolve to core's dist
    // and the tests would silently exercise a stale copy of the parser.
    alias: [
      { find: "@chativa/core/frames", replacement: path.resolve(__dirname, "../core/src/frames.ts") },
      { find: "@chativa/core", replacement: path.resolve(__dirname, "../core/src/index.ts") },
    ],
  },
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.ts", "src/index.ts"],
      // A few points below the measured numbers so CI fails on a real regression.
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
