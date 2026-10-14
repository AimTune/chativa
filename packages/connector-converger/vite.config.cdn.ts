import { defineConfig } from "vite";
import { resolve } from "path";

// Standalone <script> build: inlines connector-mekik and core's frame parser,
// so a page needs only this file (plus the widget) to talk to Converger.
export default defineConfig({
  resolve: {
    alias: [
      { find: "@chativa/core/frames", replacement: resolve(__dirname, "../core/src/frames.ts") },
      { find: "@chativa/connector-mekik", replacement: resolve(__dirname, "../connector-mekik/src/index.ts") },
    ],
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["iife"],
      name: "ChativaConverger",
      fileName: () => "chativa-converger.global.js",
    },
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    minify: "terser",
    rollupOptions: {
      external: [],
    },
  },
});
