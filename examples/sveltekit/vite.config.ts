import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

// The @chativa/* source aliases live in svelte.config.js (`kit.alias`).
export default defineConfig({
  plugins: [sveltekit()],
});
