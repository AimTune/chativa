import { defineConfig } from "vite";
import { resolve } from "path";

// ── inject-main build (IIFE, all deps bundled) ────────────────────────────
//
// inject-main.js is injected directly into the host page's MAIN world via:
//   chrome.scripting.executeScript({ files: ["inject-main.js"], world: "MAIN" })
//
// Extension-injected scripts bypass the page's Content Security Policy entirely.
// All deps (lit, zustand, @chativa/*) must be bundled — no external imports.
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
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/inject-main.ts"),
      formats: ["iife"],
      name: "ChativaInject",
      fileName: () => "inject-main.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
