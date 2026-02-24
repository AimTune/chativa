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
      external: [
        "lit",
        /^lit\//,
        "@chativa/core",
      ],
    },
    sourcemap: true,
  },
  plugins: [dts({ rollupTypes: true })],
});
