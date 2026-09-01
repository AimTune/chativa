import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    // Workspace packages resolve from source so the tests never depend on a
    // pre-built `dist`. Both entries matter: `package.json` points at `dist`,
    // so without them a clean checkout that runs tests *before* building — the
    // release workflow does exactly that — fails to resolve the package at all.
    // Source also guarantees the tests exercise one shared GenUI registry and
    // one i18next instance, which is what they are here to pin down.
    alias: {
      "@chativa/core": resolve(__dirname, "../core/src/index.ts"),
      "@chativa/genui": resolve(__dirname, "../genui/src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
  },
});
