import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * CDN build — produces a single IIFE that bundles connector + botframework-directlinejs.
 * Usage: <script src="chativa-directline.global.js"></script>
 * Exposes: window.ChativaDirectLine  (e.g. new ChativaDirectLine.DirectLineConnector({...}))
 *
 * All @chativa/core imports in the connector are type-only (erased at compile time),
 * so this bundle has zero runtime dependency on chativa.global.js.
 */
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["iife"],
      name: "ChativaDirectLine",
      fileName: () => "chativa-directline.global.js",
    },
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    minify: "terser",
    rollupOptions: {
      // Bundle everything — no externals for CDN
      external: [],
    },
  },
});
