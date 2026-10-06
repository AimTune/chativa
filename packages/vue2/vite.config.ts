import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: (fmt) => `index.${fmt === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: ["vue", "@chativa/core", "@chativa/ui", "@chativa/genui"],
      output: {
        // `index.ts` has both a default export (the plugin, for
        // `Vue.use(Chativa)`) and named exports.
        exports: "named",
      },
    },
    sourcemap: true,
  },
  plugins: [
    dts({
      rollupTypes: true,
      exclude: ["src/**/__tests__/**"],
      // Keep `@chativa/*` imports as bare specifiers in the emitted .d.ts —
      // the tsconfig `paths` (pointing at sibling sources, for typechecking)
      // would otherwise be rewritten into relative `../../core/src` imports
      // that don't exist in the published package.
      pathsToAliases: false,
    }),
  ],
});
