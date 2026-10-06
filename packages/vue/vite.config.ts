import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

// The components are authored as `defineComponent` + render functions (no
// SFCs), so no `@vitejs/plugin-vue` is needed — the build is plain TS.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: (fmt) => `index.${fmt === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: [
        "vue",
        "@chativa/core",
        "@chativa/ui",
        "@chativa/genui",
      ],
    },
    sourcemap: true,
  },
  plugins: [
    dts({
      rollupTypes: true,
      // Keep `@chativa/*` imports as package imports in the emitted .d.ts
      // instead of rewriting the tsconfig `paths` aliases (which point at
      // sibling `src/` folders) into relative paths that don't exist once
      // the package is published.
      aliasesExclude: [/^@chativa\//],
    }),
  ],
});
