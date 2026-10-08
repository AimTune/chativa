import { defineConfig } from "vitest/config";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);

// Tests run the wrappers in Angular's JIT mode: `src/test-setup.ts` loads
// `@angular/compiler`, and esbuild compiles the decorators (legacy
// `experimentalDecorators` from tsconfig.json). The wrappers use `inject()`
// rather than constructor parameters, so no decorator metadata is needed.
// The published build is AOT-compiled by ng-packagr instead.
export default defineConfig({
  resolve: {
    alias: {
      // Resolve workspace packages from source so tests don't need a pre-built dist
      "@chativa/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@chativa/ui": path.resolve(__dirname, "../ui/src/index.ts"),
      "@chativa/genui": path.resolve(__dirname, "../genui/src/index.ts"),
      "@chativa/connector-dummy": path.resolve(__dirname, "../connector-dummy/src/index.ts"),
      // `@angular/core/testing` imports `@angular/compiler` without declaring
      // it, so Node would resolve it through pnpm's hoisted store — which can
      // be the newer Angular that examples/angular-cli installs. Pin it to
      // this package's own version (the one the setup file loads).
      "@angular/compiler": require.resolve("@angular/compiler"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/__tests__/**/*.test.ts"],
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/__tests__/**", "src/test-setup.ts", "src/public-api.ts"],
      // A few points under the measured numbers (statements 99.1, branches
      // 98.7, functions 98.7, lines 100) so CI catches real regressions.
      thresholds: { lines: 96, statements: 95, functions: 94, branches: 93 },
    },
    server: {
      deps: {
        // Load Angular through Vite (not Node) so the alias above also
        // applies to imports made from inside `@angular/*`.
        inline: [/@angular\//],
      },
    },
  },
});
