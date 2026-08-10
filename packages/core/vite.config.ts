import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      // `frames` is a second entry so connectors can import the frame-routing
      // rules as code without inlining all of core — see src/frames.ts.
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        frames: resolve(__dirname, "src/frames.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (fmt, entryName) => `${entryName}.${fmt === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      // Every runtime dependency stays external so consumers resolve ONE copy
      // of it. Bundling them here gave `@chativa/core` a private i18next while
      // `@chativa/ui` initialised its own: `applyGlobalSettings` wrote the
      // host's `locale`/`i18n` overrides into an instance no component read
      // from, so bot-name and language settings silently did nothing. The same
      // duplication would give the two packages separate `lit` registries.
      // (The CDN build in vite.config.cdn.ts still bundles everything — that
      // artifact is meant to be self-contained.)
      external: ["lit", /^lit\//, "i18next", "zustand", /^zustand\//],
    },
    sourcemap: true,
  },
  plugins: [dts({ rollupTypes: true })],
});
