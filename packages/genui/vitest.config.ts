import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.ts", "src/index.ts"],
      thresholds: { lines: 30, functions: 30, branches: 20, statements: 30 },
    },
  },
});
