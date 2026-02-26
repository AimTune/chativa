import { defineConfig } from "vite";
import { resolve } from "path";

// ── Content script build (IIFE — required for Chrome content scripts) ─────
//
// Chrome does NOT support ES modules in content scripts (import/export).
// We build content.ts as a self-contained IIFE so it can be injected
// via chrome.scripting.executeScript({ files: ["content.js"] }).
export default defineConfig({
  root: ".",
  resolve: {
    alias: {
      "@chativa/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@chativa/ui": resolve(__dirname, "../../packages/ui/src/index.ts"),
      "@chativa/genui": resolve(__dirname, "../../packages/genui/src/index.ts"),
      "@chativa/connector-dummy": resolve(__dirname, "../../packages/connector-dummy/src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false, // popup was already built — don't wipe it
    lib: {
      entry: resolve(__dirname, "src/content.ts"),
      formats: ["iife"],
      name: "ChativaContent",
      fileName: () => "content.js",
    },
    rollupOptions: {
      output: {
        // Inline dynamic chunks so content.js is a single self-contained file
        inlineDynamicImports: true,
      },
    },
  },
});
