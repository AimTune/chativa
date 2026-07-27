import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Aliases resolve every @chativa/* package to its *source*, matching
// apps/sandbox's convention — lets this example run against local changes
// without a build step for any of them first.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@chativa/react": resolve(__dirname, "../../packages/react/src/index.ts"),
      "@chativa/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@chativa/ui": resolve(__dirname, "../../packages/ui/src/index.ts"),
      "@chativa/genui": resolve(__dirname, "../../packages/genui/src/index.ts"),
      "@chativa/connector-dummy": resolve(__dirname, "../../packages/connector-dummy/src/index.ts"),
    },
  },
});
