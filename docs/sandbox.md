# Sandbox

The interactive playground for every Chativa feature. Hosted at **<https://aimtune.github.io/chativa/>**.

![Sandbox overview](./assets/screenshots/sandbox/overview.png)
> _Screenshot placeholder._

## What's inside

The sandbox is a single Vite app at `apps/sandbox/`. The customisation panel docks to the left of the viewport with a vertical tab rail; each tab is a self-contained section component. The whole layout collapses to a bottom-anchored panel with a horizontal tab strip on viewports under 768 px.

| Tab | What it controls | Source |
|---|---|---|
| Appearance | Theme presets, colors, position, size, layout, window mode | `apps/sandbox/src/sandbox/sections/AppearanceSection.ts` |
| Connector | Active connector + status, kind picker (Dummy, DirectLine), per-kind options, capability matrix | `ConnectorSection.ts` |
| Features | `enableSearch`, `enableFileUpload`, `enableMultiConversation`, `showMessageStatus`, `allowFullscreen`, `hideButtonOnOpen` | `FeaturesSection.ts` |
| Messages | Inject demo messages of every built-in type | `MessagesSection.ts` |
| GenUI | Trigger every demo stream (form, card, table, chart, …) | `GenUISection.ts` |
| Typing | On/off + duration vs. until-message | `TypingSection.ts` |
| Survey | Toggle, mode, trigger, rating, kind, resetOnSubmit | `SurveySection.ts` |
| Actions | `connect`, `disconnect`, `clear`, `loadMore`, fire EventBus events | `ActionsSection.ts` |
| Config | Generated `ChativaSettings` JSON / HTML snippet / paste-to-apply | `ConfigSection.ts` |

Each tab has a sticky toolbar with a **Docs ↗** link to the matching `docs/` page and, where relevant, a **Reset** button that wipes that tab's fields back to baseline. The tab rail also has a global **Reset all** entry that mirrors the Default preset and clears the message store.

There are also two extra entry points:

- `theme-editor.html` — visual color/layout editor that exports JSON or `ThemeBuilder` code.
- `agent-panel.html` — multi-conversation demo against `DummyConnector`.

## Theme presets

The Appearance tab exposes four one-click presets:

- **Default** — full reset to documented baseline.
- **Dark** — dark-palette colors.
- **Compact** — small launcher + 320 × 440 panel.
- **Minimal** — disables search, file upload, fullscreen toggle, and the survey flow.

Presets are cumulative — Dark + Compact gives you a small dark widget. Click Default to wipe.

## Generated config

The Config tab shows a live `ChativaSettings` JSON diff (only the fields you've changed against `DEFAULT_THEME`), pinned with a `$schema` URL pointing at the schema hosted on this same GitHub Pages deployment. Copy as JSON, copy as drop-in HTML snippet, or download `chativa.config.json`.

The same tab has an Import view — paste a `ChativaSettings` blob, click Apply, and it validates the shape and routes the override into `chatStore.setTheme()` / `setConnector()`.

## Running locally

```bash
pnpm install
pnpm dev          # serves http://localhost:5173
```

Hot reload is wired to every package in the workspace via Vite aliases (see [`apps/sandbox/vite.config.ts`](../apps/sandbox/vite.config.ts)) — editing `packages/core` immediately re-renders the sandbox. The Vite plugin in that file also serves the workspace `schemas/` folder under `/schemas/*` in dev and copies the tree into `dist/schemas/` on build, so the schema `$id` URLs resolve when the sandbox is served from GitHub Pages.

## Building for GitHub Pages

```bash
VITE_BASE=/chativa/ pnpm --filter sandbox build
```

CI publishes the result to `gh-pages` and the live site at the URL above.

## Open issues

- [#13 — live preview area with viewport-resize controls](https://github.com/AimTune/chativa/issues/13) is the only remaining sandbox UX bullet. The preview area would let you snap the widget to mobile / tablet / desktop dimensions without resizing the browser.
