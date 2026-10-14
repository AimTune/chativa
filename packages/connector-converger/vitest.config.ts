import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    // Resolve @chativa/* from source so tests don't need a pre-built dist.
    // Array form so the `/frames` subpath is matched before the bare name.
    alias: [
      { find: "@chativa/core/frames", replacement: path.resolve(__dirname, "../core/src/frames.ts") },
      { find: "@chativa/core", replacement: path.resolve(__dirname, "../core/src/index.ts") },
      { find: "@chativa/connector-mekik", replacement: path.resolve(__dirname, "../connector-mekik/src/index.ts") },
    ],
  },
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.ts"],
      // A few points below the measured numbers so CI fails on a real regression.
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
