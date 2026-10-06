import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig's "jsx": "react-native" preserves JSX (bob/Metro transform it
  // later); vitest must transform the JSX in ChativaWebView.tsx itself.
  esbuild: { jsx: "automatic" },
  resolve: {
    // Resolve workspace packages from source so tests don't need pre-built
    // dists. (The bridge sources only *type*-import from them, but a future
    // value import shouldn't silently exercise a stale dist copy.)
    alias: [
      { find: "@chativa/core", replacement: path.resolve(__dirname, "../core/src/index.ts") },
      {
        find: "@chativa/connector-mekik",
        replacement: path.resolve(__dirname, "../connector-mekik/src/index.ts"),
      },
    ],
  },
  test: {
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.{ts,tsx}", "src/index.ts"],
      // A few points below the measured numbers so CI fails on a real regression.
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
