import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    // Resolve @chativa/core from source so tests don't need a pre-built dist.
    // Array form (not the object shorthand) so the `/frames` subpath is matched
    // before the bare package name — otherwise a connector importing
    // `@chativa/core/frames` would silently test core's stale dist.
    alias: [
      { find: "@chativa/core/frames", replacement: path.resolve(__dirname, "../core/src/frames.ts") },
      { find: "@chativa/core", replacement: path.resolve(__dirname, "../core/src/index.ts") },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.ts", "src/index.ts"],
    },
  },
});
