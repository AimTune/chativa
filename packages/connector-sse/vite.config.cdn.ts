import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["iife"],
      name: "ChativaSse",
      fileName: () => "chativa-sse.global.js",
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
