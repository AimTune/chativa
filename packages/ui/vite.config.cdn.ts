import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * CDN build — produces a single IIFE that bundles core + ui + all deps.
 * Usage: <script src="chativa.global.js"></script>
 * Exposes: window.Chativa
 */
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["iife"],
      name: "Chativa",
      fileName: () => "chativa.global.js",
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
  resolve: {
    alias: {
      "@chativa/core": resolve(__dirname, "../core/src/index.ts"),
      "@chativa/genui": resolve(__dirname, "../genui/src/index.ts"),
    },
  },
});
