import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "fs";
import { extname, join, posix } from "path";
import type { IncomingMessage, ServerResponse } from "http";

const SCHEMAS_SRC = resolve(__dirname, "../../schemas");

/**
 * Publishes the workspace `schemas/` folder under `/schemas/*` so the
 * `$id` URLs in every JSON Schema (https://aimtune.github.io/chativa/schemas/...)
 * actually resolve when the sandbox is hosted on GitHub Pages.
 *
 * - In `vite dev`, registers a middleware that serves files straight from
 *   the workspace `schemas/` directory.
 * - In `vite build`, recursively copies `schemas/` into `dist/schemas/`
 *   after the bundle closes.
 */
function publishSchemasPlugin(): Plugin {
  return {
    name: "chativa-publish-schemas",

    configureServer(server) {
      server.middlewares.use("/schemas", (req, res, next) => {
        try {
          const url = (req as IncomingMessage).url ?? "/";
          const rel = decodeURIComponent(url.split("?")[0]).replace(/^\/+/, "");
          const safe = posix.normalize(rel).replace(/^(\.\.[/\\])+/, "");
          const target = join(SCHEMAS_SRC, safe);

          if (!existsSync(target) || !statSync(target).isFile()) {
            next();
            return;
          }
          const r = res as ServerResponse;
          r.setHeader(
            "Content-Type",
            extname(target) === ".json"
              ? "application/json; charset=utf-8"
              : "text/plain; charset=utf-8",
          );
          r.setHeader("Access-Control-Allow-Origin", "*");
          r.end(readFileSync(target));
        } catch {
          next();
        }
      });
    },

    closeBundle() {
      if (!existsSync(SCHEMAS_SRC)) return;
      const dest = resolve(__dirname, "dist/schemas");
      const count = copyTree(SCHEMAS_SRC, dest);
      // eslint-disable-next-line no-console
      console.log(
        `[chativa-publish-schemas] copied ${count} schema(s) to ${dest}`,
      );
    },
  };
}

/**
 * Recursively copy `src` into `dest`. Returns the count of *.json files
 * copied (used for the build log).
 *
 * Implemented with the narrow set of `fs` symbols already typed in this
 * workspace — `fs.cpSync` is intentionally avoided because it is only
 * present in Node 16.7+ types and the workspace does not depend on
 * `@types/node`.
 */
function copyTree(src: string, dest: string): number {
  let n = 0;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      n += copyTree(from, to);
    } else if (entry.isFile()) {
      copyFileSync(from, to);
      if (entry.name.endsWith(".json")) n += 1;
    }
  }
  return n;
}

export default defineConfig({
  root: ".",
  // VITE_BASE is set by the GitHub Pages workflow to "/chativa/"
  base: process.env.VITE_BASE ?? "/",
  server: { port: 5173 },
  plugins: [publishSchemasPlugin()],
  resolve: {
    alias: {
      "@chativa/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@chativa/ui": resolve(__dirname, "../../packages/ui/src/index.ts"),
      "@chativa/genui": resolve(__dirname, "../../packages/genui/src/index.ts"),
      "@chativa/connector-dummy": resolve(__dirname, "../../packages/connector-dummy/src/index.ts"),
      "@chativa/connector-websocket": resolve(__dirname, "../../packages/connector-websocket/src/index.ts"),
      "@chativa/connector-signalr": resolve(__dirname, "../../packages/connector-signalr/src/index.ts"),
      "@chativa/connector-directline": resolve(__dirname, "../../packages/connector-directline/src/index.ts"),
    },
  },
});
