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
      external: [/^@chativa\/core/],
    },
    sourcemap: true,
  },
  plugins: [dts({
      rollupTypes: true,
      // Keep @chativa/* imports as package specifiers in the emitted .d.ts —
      // otherwise the tsconfig `paths` aliases get rewritten to
      // "../../core/src/index.ts", which does not exist once published.
      aliasesExclude: [/^@chativa\//],
    })],
});
