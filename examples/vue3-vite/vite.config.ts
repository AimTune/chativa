import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

// Aliases resolve every @chativa/* package to its *source*, matching
// apps/sandbox's and examples/react-vite's convention — lets this example run
// against local changes without a build step for any of them first.
//
// Note there is no `compilerOptions.isCustomElement` here: the app only uses
// the @chativa/vue wrapper components, never the raw `<chat-iva>` tag.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@chativa/vue": resolve(__dirname, "../../packages/vue/src/index.ts"),
      "@chativa/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@chativa/ui": resolve(__dirname, "../../packages/ui/src/index.ts"),
      "@chativa/genui": resolve(__dirname, "../../packages/genui/src/index.ts"),
      "@chativa/connector-dummy": resolve(__dirname, "../../packages/connector-dummy/src/index.ts"),
    },
  },
});
