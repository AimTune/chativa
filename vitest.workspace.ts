import { defineWorkspace } from "vitest/config";
import { resolve } from "path";

export default defineWorkspace([
  {
    test: {
      name: "core",
      root: resolve(__dirname, "packages/core"),
      environment: "jsdom",
      include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
    },
  },
  {
    test: {
      name: "ui",
      root: resolve(__dirname, "packages/ui"),
      environment: "jsdom",
      include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
    },
  },
]);
