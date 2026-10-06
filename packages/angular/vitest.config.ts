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
    server: {
      deps: {
        // Load Angular through Vite (not Node) so the alias above also
        // applies to imports made from inside `@angular/*`.
        inline: [/@angular\//],
      },
    },
  },
});
