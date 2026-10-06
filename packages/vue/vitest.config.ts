import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // Resolve workspace packages from source so tests don't need a pre-built dist
      "@chativa/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@chativa/ui": path.resolve(__dirname, "../ui/src/index.ts"),
      "@chativa/genui": path.resolve(__dirname, "../genui/src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.test.ts"],
    // The first test that mounts an element pays for the dynamic
    // `import("@chativa/ui")`, which can be slow in a cold worker.
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.ts", "src/index.ts", "src/vite-env.d.ts"],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});
