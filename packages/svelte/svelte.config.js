// Svelte 5 strips `<script lang="ts">` type annotations natively, so no
// preprocessor is needed. This file exists so `svelte-package`,
// `svelte-check` and `@sveltejs/vite-plugin-svelte` share one config.
/** @type {import("svelte/compiler").CompileOptions} */
const compilerOptions = {
  runes: true,
};

export default { compilerOptions };
