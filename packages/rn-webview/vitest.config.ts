import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
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
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
