import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";
import { copyFileSync, existsSync, mkdirSync } from "fs";

/**
 * Copies manifest.json + icon PNGs into dist/ after each build.
 * Icons are sourced from `public/icons/icon-{size}.png` so artwork lives
 * outside the build entry points; the manifest references `icons/icon-{size}.png`.
 */
function copyManifestPlugin(): Plugin {
  return {
    name: "copy-manifest",
    closeBundle() {
      copyFileSync("manifest.json", "dist/manifest.json");
      mkdirSync("dist/icons", { recursive: true });
      for (const size of [16, 32, 48, 128]) {
        const file = `icon-${size}.png`;
        const src = `public/icons/${file}`;
        if (existsSync(src)) copyFileSync(src, `dist/icons/${file}`);
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
