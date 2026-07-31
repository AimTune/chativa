# CLAUDE.md — Chativa

Chativa is a Ports & Adapters (hexagonal) chat widget library — LitElement Web Components, Zustand state, TypeScript strict — built as a pnpm monorepo: `packages/` (core, ui, genui, connector-*, react, rn-webview), `apps/` (sandbox), `examples/`, `website/` (Docusaurus docs site) and `docs/` (GitHub-flavored markdown mirror). See [AGENTS.md](./AGENTS.md) for architecture rules, layer boundaries and templates.

## Documentation

- Any user-facing feature or behavior change MUST update the web docs in the **same PR**: `website/docs/` (the published site) and its `docs/` mirror. Docs are part of the definition of done — a feature is not finished until it is documented where a reader would look.
- New pages must be registered in `website/sidebars.ts`.
- Match the existing pages' language (English), tone and formatting; use real API names taken from the source, never invented ones.
