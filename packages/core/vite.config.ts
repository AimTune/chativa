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
    rollupOptions: {},
    sourcemap: true,
  },
  plugins: [dts({ rollupTypes: true })],
});
