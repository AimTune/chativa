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
      // connector-mekik is a real dependency: the npm build imports it rather
      // than inlining a second copy of the class this one extends.
      external: [/^@chativa\/core/, /^@chativa\/connector-mekik/],
    },
    sourcemap: true,
  },
  plugins: [dts({
      rollupTypes: true,
      // Keep @chativa/* imports as package specifiers in the emitted .d.ts —
      // otherwise the tsconfig `paths` aliases get rewritten to source paths
      // that do not exist once published.
      aliasesExclude: [/^@chativa\//],
    })],
});
