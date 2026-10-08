import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // Resolve workspace packages from source so tests don't need a pre-built dist
      "@chativa/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@chativa/ui": path.resolve(__dirname, "../ui/src/index.ts"),
      "@chativa/genui": path.resolve(__dirname, "../genui/src/index.ts"),
      // Vitest resolves node_modules with the `node` export condition, which
      // picks @lit/react's SSR build — that build never assigns element
      // properties. Tests run in jsdom, so use the browser build that apps get.
      "@lit/react": path.resolve(__dirname, "node_modules/@lit/react/development/index.js"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.test.tsx", "src/**/__tests__/**/*.test.ts"],
    // The first test to mount a widget pays for the dynamic import of
    // @chativa/ui, which can exceed the 5s default in a cold worker.
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.{ts,tsx}", "src/**/*.d.ts", "src/index.ts"],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
