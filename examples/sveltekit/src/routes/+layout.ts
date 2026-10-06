// Prerender every page: `vite build` then server-renders them, which is the
// check that @chativa/svelte imports and renders cleanly without a DOM.
// SSR stays on (the SvelteKit default) — nothing here opts out of it.
export const prerender = true;
