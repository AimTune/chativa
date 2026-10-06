import adapter from "@sveltejs/adapter-static";

/** @type {import("@sveltejs/kit").Config} */
const config = {
  kit: {
    // Every route is prerendered (see src/routes/+layout.ts), so `vite build`
    // server-renders the page — that is what proves @chativa/svelte is
    // SSR-safe, not just client-safe.
    adapter: adapter(),
    // Resolve every @chativa/* package to its *source*, matching
    // apps/sandbox's and examples/react-vite's convention — lets this example
    // run against local changes without building any of them first.
    // `kit.alias` feeds both Vite and the generated tsconfig `paths`.
    alias: {
      "@chativa/svelte": "../../packages/svelte/src/index.ts",
      "@chativa/core": "../../packages/core/src/index.ts",
      "@chativa/ui": "../../packages/ui/src/index.ts",
      "@chativa/genui": "../../packages/genui/src/index.ts",
      "@chativa/connector-dummy": "../../packages/connector-dummy/src/index.ts",
    },
  },
};

export default config;
