import { defineConfig } from "vitest/config";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      // Resolve workspace packages from source so tests don't need a pre-built dist
      "@chativa/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@chativa/ui": path.resolve(__dirname, "../ui/src/index.ts"),
      "@chativa/genui": path.resolve(__dirname, "../genui/src/index.ts"),
      // Pin `vue` to THIS package's Vue 2.7. The monorepo also carries Vue 3
      // (packages/vue), and depending on hoisting a bare `require("vue")` can
      // land on it.
      vue: require.resolve("vue/dist/vue.runtime.mjs"),
      // Skip vue-template-compiler's index.js entirely: its version guard does
      // a NATIVE `require.resolve("vue")` that no Vite alias can reach, walks
      // into pnpm's hidden hoist store, finds Vue 3 and throws "Vue packages
      // version mismatch". build.js is the same compiler without the guard.
      "vue-template-compiler": require.resolve("vue-template-compiler/build.js"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/__tests__/setup.ts"],
    server: {
      deps: {
        // Load test-utils AND vue-template-compiler through Vite so the alias
        // above applies inside them too. vue-template-compiler declares no vue
        // dependency at all, so its native `require("vue")` would otherwise
        // walk up into pnpm's hidden hoist store — where Vue 3 can win.
        inline: [/@vue\/test-utils/, /vue-template-compiler/],
      },
    },
    // The first mount in each file dynamically imports the whole @chativa/ui
    // bundle, which can overrun the 5s default in a cold, busy worker.
    testTimeout: 30000,
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.ts", "src/index.ts", "src/**/*.d.ts"],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});
