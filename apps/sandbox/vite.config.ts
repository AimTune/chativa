import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  server: { port: 5173 },
  resolve: {
    alias: {
      "@chativa/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@chativa/ui":   resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
});
