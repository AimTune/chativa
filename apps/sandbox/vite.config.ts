import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  server: { port: 5173 },
  resolve: {
    alias: {
      "@chativa/core":               resolve(__dirname, "../../packages/core/src/index.ts"),
      "@chativa/ui":                 resolve(__dirname, "../../packages/ui/src/index.ts"),
      "@chativa/connector-dummy":    resolve(__dirname, "../../packages/connector-dummy/src/index.ts"),
      "@chativa/connector-websocket":resolve(__dirname, "../../packages/connector-websocket/src/index.ts"),
      "@chativa/connector-signalr":  resolve(__dirname, "../../packages/connector-signalr/src/index.ts"),
      "@chativa/connector-directline":resolve(__dirname, "../../packages/connector-directline/src/index.ts"),
    },
  },
});
