# @chativa/svelte example (SvelteKit)

Living usage doc for [`@chativa/svelte`](../../packages/svelte) — a
**prerendered** SvelteKit app with `<ChativaProvider>`, a custom
`<ChatBotButton>` launcher, `<ChatIva>` callback props and the
`$chatState` / `$messages` stores, wired to `@chativa/connector-dummy`.

## Running it

From the repo root (this is a pnpm workspace member, not a standalone app):

```sh
pnpm install
pnpm --filter chativa-example-sveltekit dev
```

`pnpm --filter chativa-example-sveltekit build` prerenders the page, i.e.
server-renders it in Node — the check that the wrapper is SSR-safe. The
static site is written to `build/`.

Every `@chativa/*` import resolves to the package's `src/` via `kit.alias`
in `svelte.config.js`, so no package needs building first.
