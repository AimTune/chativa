import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: (fmt) => `index.${fmt === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@lit/react",
        "@chativa/core",
        "@chativa/ui",
        "@chativa/genui",
      ],
      output: {
        // Rollup drops per-module "use client" directives once everything is
        // merged into one chunk — re-add it as a banner so Next.js App
        // Router still treats every export here as a Client Component
        // without consumers needing their own 'use client' wrapper.
        banner: '"use client";',
      },
    },
    sourcemap: true,
  },
  plugins: [dts({ rollupTypes: true })],
});
