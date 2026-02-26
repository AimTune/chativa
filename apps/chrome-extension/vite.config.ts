import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";
import { copyFileSync, existsSync } from "fs";

/** Copies manifest.json (and optional icon PNGs) into dist/ after each build. */
function copyManifestPlugin(): Plugin {
  return {
    name: "copy-manifest",
    closeBundle() {
      copyFileSync("manifest.json", "dist/manifest.json");
      for (const icon of ["icon16.png", "icon48.png", "icon128.png"]) {
        if (existsSync(icon)) copyFileSync(icon, `dist/${icon}`);
      }
    },
  };
}

// ── Popup build (standard ESM page) ──────────────────────────────────────
export default defineConfig({
  root: ".",
  plugins: [copyManifestPlugin()],
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
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
