import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: (fmt) => `index.${fmt === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: ["lit", "lit/decorators.js", "lit/directives/unsafe-html.js", "@chativa/core", "@chativa/ui", "marked"],
    },
    sourcemap: true,
  },
  plugins: [dts({ rollupTypes: true })],
});
